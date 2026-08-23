#!/usr/bin/env python3
"""
SARI 2 Advanced Predictive Analytics & Restocking Engine
Strict Object-Oriented Programming (OOP) implementation.
Handles:
- Expiration + Stock + Sales Velocity synthesis
- Increasing/decreasing sales trends detection
- Weather-based demand adjustments
- Seasonal/Event-based demand adjustments
- Automated Weekly AI Store Summary
- Expiration-aware restocking & prioritize-selling recommendations
"""

import sys
import json
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any, Tuple


class SeasonalMultiplier:
    """
    Represents Philippine local seasons and holidays affecting store sales velocity.
    """
    PRESETS: Dict[str, Dict[str, Any]] = {
        "NORMAL": {"mult": 1.0, "desc": "Regular daily operations"},
        "PAYDAY": {"mult": 1.35, "desc": "15th / 30th salary cycle boost"},
        "CHRISTMAS": {"mult": 1.75, "desc": "Holiday season & gatherings"},
        "NEW_YEAR": {"mult": 1.80, "desc": "New Year celebrations & food prep"},
        "VALENTINES": {"mult": 1.30, "desc": "Chocolates, snacks & gifts rush"},
        "HOLY_WEEK": {"mult": 1.25, "desc": "Canned fish, noodles & essentials"},
        "ALL_SOULS_DAY": {"mult": 1.40, "desc": "Undas rush, candles & snacks"},
        "SUMMER": {"mult": 1.45, "desc": "Cold drinks, ice, ice cream & snacks"},
        "RAINY_SEASON": {"mult": 1.30, "desc": "Noodles, coffee & hot soup meals"}
    }

    def __init__(self, factor_name: str = "NORMAL"):
        self.factor_name = factor_name.upper()
        preset = self.PRESETS.get(self.factor_name, {"mult": 1.0, "desc": "Normal"})
        self.multiplier = float(preset["mult"])
        self.description = preset["desc"]

    def __repr__(self) -> str:
        return f"<SeasonalMultiplier name='{self.factor_name}' mult={self.multiplier:.2f}>"


class WeatherMultiplier:
    """
    Modulates product category demand based on daily weather conditions.
    """
    WEATHER_FACTORS: Dict[str, Dict[str, float]] = {
        "HOT_SUNNY": {
            "Beverages": 1.50,
            "Snacks": 1.20,
            "default": 1.05
        },
        "RAINY": {
            "Instant Noodles": 1.60,
            "Beverages": 0.85, # Cold drinks drop, hot coffee/chocolate up
            "Canned Goods": 1.30,
            "Condiments": 1.15,
            "default": 1.10
        },
        "STORMY": {
            "Canned Goods": 1.80,
            "Instant Noodles": 1.80,
            "Grains & Rice": 1.50,
            "Toiletries": 1.20,
            "default": 1.25
        },
        "NORMAL": {
            "default": 1.00
        }
    }

    def __init__(self, weather_type: str = "NORMAL"):
        self.weather_type = weather_type.upper()
        self.factors = self.WEATHER_FACTORS.get(self.weather_type, self.WEATHER_FACTORS["NORMAL"])

    def get_category_multiplier(self, category_name: str) -> float:
        return self.factors.get(category_name, self.factors.get("default", 1.0))

    def __repr__(self) -> str:
        return f"<WeatherMultiplier type='{self.weather_type}'>"


class ProductItem:
    """
    Encapsulates product telemetry, costs, prices, expiration, and sales velocity over time windows.
    """
    def __init__(
        self,
        product_id: str,
        name: str,
        current_stock: float,
        cost_price: float,
        unit_price: float,
        transpo_fee: float,
        unit: str,
        low_stock_threshold: float,
        category_name: str,
        supplier_name: Optional[str] = None,
        expiration_date: Optional[str] = None
    ):
        self.product_id: str = product_id
        self.name: str = name
        self.current_stock: float = float(current_stock)
        self.cost_price: float = float(cost_price)
        self.unit_price: float = float(unit_price)
        self.transpo_fee: float = float(transpo_fee)
        self.unit: str = unit or "pcs"
        self.low_stock_threshold: float = float(low_stock_threshold)
        self.category_name: str = category_name or "General"
        self.supplier_name: str = supplier_name or "Direct Wholesale"
        self.expiration_date: Optional[str] = expiration_date

        # Sales telemetry tracking
        self.units_sold_30d: float = 0.0
        self.revenue_30d: float = 0.0
        self.units_sold_recent_15d: float = 0.0
        self.units_sold_previous_15d: float = 0.0

    @property
    def total_cost_per_unit(self) -> float:
        return self.cost_price + self.transpo_fee

    @property
    def profit_per_unit(self) -> float:
        return self.unit_price - self.total_cost_per_unit

    @property
    def profit_margin_pct(self) -> float:
        if self.unit_price <= 0:
            return 0.0
        return round((self.profit_per_unit / self.unit_price) * 100, 1)

    @property
    def is_expired(self) -> bool:
        if not self.expiration_date:
            return False
        try:
            exp = datetime.fromisoformat(self.expiration_date.replace("Z", "+00:00"))
            return exp < datetime.now(timezone.utc)
        except Exception:
            return False

    @property
    def days_until_expiry(self) -> Optional[int]:
        if not self.expiration_date:
            return None
        try:
            exp = datetime.fromisoformat(self.expiration_date.replace("Z", "+00:00"))
            diff = exp - datetime.now(timezone.utc)
            return diff.days
        except Exception:
            return None

    def record_sale(self, quantity: float, price: float, days_ago: float) -> None:
        qty = float(quantity)
        self.units_sold_30d += qty
        self.revenue_30d += qty * float(price)

        if days_ago <= 15:
            self.units_sold_recent_15d += qty
        else:
            self.units_sold_previous_15d += qty

    @property
    def sales_trend_pct(self) -> Optional[float]:
        """
        Calculates percentage increase/decrease in sales between previous 15d and recent 15d.
        """
        if self.units_sold_previous_15d == 0 and self.units_sold_recent_15d == 0:
            return 0.0
        if self.units_sold_previous_15d == 0:
            return 100.0 # Surge from 0
        diff = self.units_sold_recent_15d - self.units_sold_previous_15d
        return round((diff / self.units_sold_previous_15d) * 100, 1)

    def __repr__(self) -> str:
        return (
            f"<ProductItem id='{self.product_id}' name='{self.name}' "
            f"stock={self.current_stock} profit=₱{self.profit_per_unit:.2f}>"
        )


class SmartRecommendation:
    """
    Intelligent recommendation that handles both restocking & expiration sell-off advice.
    """
    def __init__(
        self,
        product: ProductItem,
        action: str, # "RESTOCK", "PRIORITIZE_SELLING", "DISPOSE_EXPIRED", "MONITOR"
        recommended_buy_qty: int,
        forecasted_weekly_demand: float,
        expected_sales_before_expiry: Optional[float],
        message: str,
        reason: str
    ):
        self.product = product
        self.action = action
        self.recommended_buy_qty = int(recommended_buy_qty)
        self.forecasted_weekly_demand = round(forecasted_weekly_demand, 1)
        self.expected_sales_before_expiry = round(expected_sales_before_expiry, 1) if expected_sales_before_expiry is not None else None
        self.message = message
        self.reason = reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "productId": self.product.product_id,
            "productName": self.product.name,
            "categoryName": self.product.category_name,
            "supplierName": self.product.supplier_name,
            "currentStock": self.product.current_stock,
            "costPrice": self.product.cost_price,
            "transpoFee": self.product.transpo_fee,
            "unitPrice": self.product.unit_price,
            "profitPerUnit": self.product.profit_per_unit,
            "profitMarginPct": self.product.profit_margin_pct,
            "lowStockThreshold": self.product.low_stock_threshold,
            "unit": self.product.unit,
            "action": self.action,
            "recommendedRestockQty": self.recommended_buy_qty,
            "estimatedCost": round(self.recommended_buy_qty * self.product.total_cost_per_unit, 2),
            "forecastedWeeklyDemand": self.forecasted_weekly_demand,
            "expectedSalesBeforeExpiry": self.expected_sales_before_expiry,
            "daysUntilExpiry": self.product.days_until_expiry,
            "isExpired": self.product.is_expired,
            "salesTrendPct": self.product.sales_trend_pct,
            "message": self.message,
            "reason": self.reason
        }

    def __repr__(self) -> str:
        return f"<SmartRecommendation product='{self.product.name}' action='{self.action}' message='{self.message}'>"


class PredictiveEngine:
    """
    The central intelligence engine that integrates 30-day velocity, weather multipliers,
    seasonal adjustments, and expiration timelines.
    """
    def __init__(self, seasonal_factor: SeasonalMultiplier, weather_factor: WeatherMultiplier):
        self.seasonal_factor = seasonal_factor
        self.weather_factor = weather_factor
        self.products: Dict[str, ProductItem] = {}

    def add_product(self, product: ProductItem) -> None:
        self.products[product.product_id] = product

    def ingest_sales_history(self, sales_items: List[Dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc)
        for item in sales_items:
            prod_id = item.get("productId")
            qty = float(item.get("quantity", 0))
            price = float(item.get("priceAtSale", 0))
            
            # Calculate days ago
            days_ago = 0.0
            sale_date_str = item.get("saleDate")
            if sale_date_str:
                try:
                    s_date = datetime.fromisoformat(sale_date_str.replace("Z", "+00:00"))
                    days_ago = max(0.0, (now - s_date).total_seconds() / 86400.0)
                except Exception:
                    days_ago = 10.0

            if prod_id in self.products:
                self.products[prod_id].record_sale(qty, price, days_ago)

    def analyze_trends(self) -> List[Dict[str, Any]]:
        """
        Detects significant increasing or decreasing sales trends across products.
        """
        trends = []
        for p in self.products.values():
            pct = p.sales_trend_pct
            if pct is not None and abs(pct) >= 15.0 and p.units_sold_30d >= 3:
                status = "INCREASING" if pct > 0 else "DECLINING"
                direction_text = f"increased by {abs(pct)}%" if pct > 0 else f"declined by {abs(pct)}%"
                trends.append({
                    "productId": p.product_id,
                    "productName": p.name,
                    "trendStatus": status,
                    "trendPct": pct,
                    "message": f"{p.name} sales {direction_text} over the last 15 days."
                })
        # Sort by highest absolute change
        trends.sort(key=lambda x: abs(x["trendPct"]), reverse=True)
        return trends

    def generate_recommendations(self) -> List[SmartRecommendation]:
        recommendations: List[SmartRecommendation] = []
        weeks_in_period = 30.0 / 7.0 # 4.28 weeks

        for p in self.products.values():
            base_weekly = p.units_sold_30d / weeks_in_period
            daily_velocity = p.units_sold_30d / 30.0

            # Combine seasonal & weather factors
            weather_mult = self.weather_factor.get_category_multiplier(p.category_name)
            adjusted_weekly = base_weekly * self.seasonal_factor.multiplier * weather_mult
            forecasted_weekly_demand = max(
                1.0 if p.units_sold_30d > 0 else 0.0,
                adjusted_weekly * 1.15 # 15% buffer
            )

            days_left = p.days_until_expiry

            # 1. EXPIRED CASE
            if p.is_expired:
                recommendations.append(
                    SmartRecommendation(
                        product=p,
                        action="DISPOSE_EXPIRED",
                        recommended_buy_qty=max(5, int(p.low_stock_threshold * 2)),
                        forecasted_weekly_demand=forecasted_weekly_demand,
                        expected_sales_before_expiry=0,
                        message=f"{p.name} has expired! Dispose of expired units immediately and restock fresh inventory.",
                        reason="Expired Goods"
                    )
                )
                continue

            # 2. EXPIRING SOON + VELOCITY SYNTHESIS
            # Example: "15 units remain, but only 3 are expected to sell before expiration."
            if days_left is not None and days_left <= 45:
                expected_to_sell = daily_velocity * days_left
                if p.current_stock > (expected_to_sell + 2):
                    # Risk of waste: stock is higher than what can sell before expiry!
                    recommendations.append(
                        SmartRecommendation(
                            product=p,
                            action="PRIORITIZE_SELLING",
                            recommended_buy_qty=0,
                            forecasted_weekly_demand=forecasted_weekly_demand,
                            expected_sales_before_expiry=expected_to_sell,
                            message=(
                                f"{int(p.current_stock)} {p.unit}s remain with {days_left} days left, "
                                f"but only ~{max(1, math.ceil(expected_to_sell))} are expected to sell before expiry. "
                                f"Prioritize selling (or bundle/discount) and do NOT restock."
                            ),
                            reason="Overstocked Expiring Inventory"
                        )
                    )
                    continue

            # 3. LOW STOCK / HIGH DEMAND RESTOCK
            if p.current_stock <= p.low_stock_threshold or (p.current_stock < forecasted_weekly_demand and p.units_sold_30d > 0):
                target_stock = math.ceil((forecasted_weekly_demand * 2.0) + p.low_stock_threshold)
                buy_qty = max(1, target_stock - int(p.current_stock))
                
                # Contextual message
                reason_parts = []
                if p.current_stock <= p.low_stock_threshold:
                    reason_parts.append(f"stock is at {int(p.current_stock)} (below threshold {int(p.low_stock_threshold)})")
                if self.seasonal_factor.multiplier > 1.0:
                    reason_parts.append(f"{self.seasonal_factor.description} ({self.seasonal_factor.multiplier}x)")
                if weather_mult > 1.0:
                    reason_parts.append(f"{self.weather_factor.weather_type} weather boost")

                reason_text = " & ".join(reason_parts)
                recommendations.append(
                    SmartRecommendation(
                        product=p,
                        action="RESTOCK",
                        recommended_buy_qty=buy_qty,
                        forecasted_weekly_demand=forecasted_weekly_demand,
                        expected_sales_before_expiry=None,
                        message=f"Buy {buy_qty} {p.unit}(s) from {p.supplier_name}. ({reason_text})",
                        reason=f"Restock Required ({reason_text})"
                    )
                )

        # Sort: Expired first, then Prioritize Selling, then Restock
        action_order = {"DISPOSE_EXPIRED": 0, "PRIORITIZE_SELLING": 1, "RESTOCK": 2, "MONITOR": 3}
        recommendations.sort(key=lambda r: (action_order.get(r.action, 4), -r.recommended_buy_qty))
        return recommendations

    def generate_store_summary(
        self,
        recommendations: List[SmartRecommendation],
        trends: List[Dict[str, Any]],
        fast_movers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Creates an executive store overview for the owner.
        """
        restock_count = sum(1 for r in recommendations if r.action in ("RESTOCK", "DISPOSE_EXPIRED"))
        expiry_risk_count = sum(1 for r in recommendations if r.action == "PRIORITIZE_SELLING")
        top_movers_names = [f["name"] for f in fast_movers[:2]]

        summary_paragraphs = []
        
        # 1. Demand & Trends Overview
        if top_movers_names:
            movers_str = " and ".join(top_movers_names)
            summary_paragraphs.append(f"Top-selling drivers this period: {movers_str}.")
        
        # 2. Season/Weather Influence
        if self.seasonal_factor.multiplier > 1.0 or self.weather_factor.weather_type != "NORMAL":
            summary_paragraphs.append(
                f"Demand adjusted for {self.seasonal_factor.factor_name} ({self.seasonal_factor.multiplier}x) "
                f"and {self.weather_factor.weather_type} weather conditions."
            )

        # 3. Action items
        summary_paragraphs.append(
            f"{restock_count} product(s) require purchasing to prevent stockouts. "
            f"{expiry_risk_count} product(s) flagged at risk of expiring before normal sale."
        )

        return {
            "headline": f"Store Intelligence Summary — {self.seasonal_factor.factor_name} / {self.weather_factor.weather_type}",
            "restockCount": restock_count,
            "expiryRiskCount": expiry_risk_count,
            "summaryText": " ".join(summary_paragraphs),
            "trends": trends[:4]
        }


def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "Empty input payload"}))
            sys.exit(1)

        payload = json.loads(raw_input)
        
        season_name = payload.get("seasonalFactor", "NORMAL")
        weather_name = payload.get("weatherFactor", "NORMAL")

        seasonal_multiplier = SeasonalMultiplier(season_name)
        weather_multiplier = WeatherMultiplier(weather_name)

        engine = PredictiveEngine(seasonal_multiplier, weather_multiplier)

        # 1. Load Products
        for prod_data in payload.get("products", []):
            product = ProductItem(
                product_id=prod_data["id"],
                name=prod_data["name"],
                current_stock=prod_data.get("stockQty", 0),
                cost_price=prod_data.get("costPrice", 0),
                unit_price=prod_data.get("price", 0),
                transpo_fee=prod_data.get("transpoFee", 0),
                unit=prod_data.get("unit", "pcs"),
                low_stock_threshold=prod_data.get("lowStockThreshold", 5),
                category_name=prod_data.get("category", {}).get("name", "General") if prod_data.get("category") else "General",
                supplier_name=prod_data.get("supplier", {}).get("name", "Direct Wholesale") if prod_data.get("supplier") else "Direct Wholesale",
                expiration_date=prod_data.get("expirationDate")
            )
            engine.add_product(product)

        # 2. Ingest Sales History
        sales_items = payload.get("salesItems", [])
        engine.ingest_sales_history(sales_items)

        # 3. Compute Analytics
        recommendations = engine.generate_recommendations()
        trends = engine.analyze_trends()
        
        # Fast & Slow Movers
        sorted_prods = sorted(
            [p for p in engine.products.values() if p.units_sold_30d > 0],
            key=lambda x: x.units_sold_30d,
            reverse=True
        )
        fast_movers = [
            {"id": p.product_id, "name": p.name, "qty": p.units_sold_30d, "sales": round(p.revenue_30d, 2)}
            for p in sorted_prods[:3]
        ]
        slow_movers = [
            {"id": p.product_id, "name": p.name, "qty": p.units_sold_30d, "sales": round(p.revenue_30d, 2)}
            for p in sorted(list(engine.products.values()), key=lambda x: x.units_sold_30d)[:3]
        ]

        store_summary = engine.generate_store_summary(recommendations, trends, fast_movers)

        # 4. Grocery Shopping List
        restock_items = [r.to_dict() for r in recommendations if r.action in ("RESTOCK", "DISPOSE_EXPIRED")]
        supplier_groups: Dict[str, List[Dict[str, Any]]] = {}
        for item in restock_items:
            sup = item["supplierName"]
            if sup not in supplier_groups:
                supplier_groups[sup] = []
            supplier_groups[sup].append(item)

        shopping_list = {
            "totalItemsCount": len(restock_items),
            "totalUnitsToBuy": sum(i["recommendedRestockQty"] for i in restock_items),
            "totalEstimatedBudget": round(sum(i["estimatedCost"] for i in restock_items), 2),
            "items": restock_items,
            "groupedBySupplier": supplier_groups
        }

        output = {
            "success": True,
            "engine": "Python-OOP-v3",
            "seasonalMultiplier": seasonal_multiplier.multiplier,
            "seasonalFactorName": seasonal_multiplier.factor_name,
            "weatherFactorName": weather_multiplier.weather_type,
            "fastMovers": fast_movers,
            "slowMovers": slow_movers,
            "trends": trends,
            "recommendations": [r.to_dict() for r in recommendations],
            "groceryShoppingList": shopping_list,
            "storeSummary": store_summary
        }

        print(json.dumps(output))
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "engine": "Python-OOP-v3-Error"
        }
        print(json.dumps(error_output))
        sys.exit(1)


if __name__ == "__main__":
    main()
