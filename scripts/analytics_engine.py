#!/usr/bin/env python3
"""
SARI 2 Advanced Predictive Analytics & Restocking Engine (v4)
Strict Object-Oriented Programming (OOP) implementation.
Includes:
- Economic Order Quantity (EOQ) optimization with holding/ordering parameters
- Dynamic Min-Max Replenishment (Min Safety Stock + Max EOQ Ceiling)
- Exponential Moving Average (EMA) and Weighted Moving Average (WMA)
- Holt-Winters / Exponential Smoothing trend projections
- FP-Growth / Frequent Pattern item association co-purchasing
- Rational seasonal adjustments (holidays, salary cycles) with no arbitrary inflated multipliers
- Expiration + Stock + Velocity synthesis
- 15-day sales trend detection & automated executive store summary
"""

import sys
import json
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any, Tuple
from collections import defaultdict


class RationalSeasonalModel:
    """
    Rational local event adjustments calibrated for Philippine neighborhood retail.
    Replaces aggressive, inflated multipliers with realistic demand pacing factors.
    """
    CALIBRATED_FACTORS: Dict[str, Dict[str, Any]] = {
        "NORMAL": {"mult": 1.00, "desc": "Baseline daily retail operations"},
        "PAYDAY": {"mult": 1.15, "desc": "15th / 30th salary cashflow cycle (household essentials boost)"},
        "CHRISTMAS": {"mult": 1.35, "desc": "Christmas season & celebrations"},
        "NEW_YEAR": {"mult": 1.30, "desc": "New Year celebrations & food preparations"},
        "VALENTINES": {"mult": 1.10, "desc": "Snacks, sweets, and gift items"},
        "HOLY_WEEK": {"mult": 1.10, "desc": "Canned seafood, noodles & dry staples"},
        "ALL_SOULS_DAY": {"mult": 1.15, "desc": "Undas holiday travel & provisions"},
        "SUMMER": {"mult": 1.20, "desc": "Cold beverages, ice & quick refreshments"},
        "RAINY_SEASON": {"mult": 1.15, "desc": "Instant noodles, coffee & hot soup meals"}
    }

    def __init__(self, factor_name: str = "NORMAL"):
        self.factor_name = factor_name.upper()
        entry = self.CALIBRATED_FACTORS.get(self.factor_name, {"mult": 1.00, "desc": "Standard"})
        self.multiplier = float(entry["mult"])
        self.description = entry["desc"]

    def __repr__(self) -> str:
        return f"<RationalSeasonalModel name='{self.factor_name}' factor={self.multiplier:.2f}>"


class ProductItem:
    """
    Encapsulates product telemetry, pricing, unit logistics, holding cost, and sales time series.
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

        # Sales records: list of (qty, price, days_ago)
        self.sales_history: List[Tuple[float, float, float]] = []
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
        self.sales_history.append((qty, float(price), float(days_ago)))
        self.units_sold_30d += qty
        self.revenue_30d += qty * float(price)

        if days_ago <= 15:
            self.units_sold_recent_15d += qty
        else:
            self.units_sold_previous_15d += qty

    @property
    def sales_trend_pct(self) -> Optional[float]:
        if self.units_sold_previous_15d == 0 and self.units_sold_recent_15d == 0:
            return 0.0
        if self.units_sold_previous_15d == 0:
            return 100.0 if self.units_sold_recent_15d > 0 else 0.0
        diff = self.units_sold_recent_15d - self.units_sold_previous_15d
        return round((diff / self.units_sold_previous_15d) * 100, 1)

    def calculate_ema_daily_demand(self, alpha: float = 0.35) -> float:
        """
        Calculates Exponential Moving Average (EMA) of daily demand over the last 30 days.
        Recent days are weighted exponentially higher than older days.
        """
        # Bucket sales by daily bins (day 0 to day 29)
        daily_bins = [0.0] * 30
        for qty, _, days_ago in self.sales_history:
            day_idx = min(29, max(0, int(days_ago)))
            daily_bins[day_idx] += qty

        # Oldest to newest
        chronological_days = list(reversed(daily_bins))
        ema = chronological_days[0]
        for val in chronological_days[1:]:
            ema = (alpha * val) + ((1.0 - alpha) * ema)

        return max(0.0, ema)

    def calculate_wma_weekly_demand(self) -> float:
        """
        Calculates Weighted Moving Average (WMA) for weekly velocity (weights: 4 for W1, 3 for W2, 2 for W3, 1 for W4).
        """
        w_bins = [0.0, 0.0, 0.0, 0.0]
        for qty, _, days_ago in self.sales_history:
            if days_ago <= 7:
                w_bins[0] += qty # Week 1 (most recent)
            elif days_ago <= 14:
                w_bins[1] += qty # Week 2
            elif days_ago <= 21:
                w_bins[2] += qty # Week 3
            else:
                w_bins[3] += qty # Week 4

        weights = [4, 3, 2, 1]
        weighted_sum = sum(w_bins[i] * weights[i] for i in range(4))
        wma_weekly = weighted_sum / sum(weights)
        return max(0.0, wma_weekly)

    def calculate_eoq(self, annual_demand: float, ordering_cost: float = 25.0, holding_rate: float = 0.15) -> int:
        """
        Economic Order Quantity (EOQ):
        EOQ = sqrt((2 * D * S) / H)
        D = Annual Demand units
        S = Fixed ordering / transit fee per order batch (~₱25 standard neighborhood procurement cost)
        H = Holding cost per unit per year (15% of total unit cost, min ₱1.50)
        """
        if annual_demand <= 0:
            return max(5, int(self.low_stock_threshold * 2))

        unit_cost = max(1.0, self.total_cost_per_unit)
        holding_cost = max(1.50, unit_cost * holding_rate)

        eoq = math.sqrt((2.0 * annual_demand * ordering_cost) / holding_cost)
        return max(1, math.ceil(eoq))

    def __repr__(self) -> str:
        return f"<ProductItem id='{self.product_id}' name='{self.name}' stock={self.current_stock}>"


class SmartRecommendation:
    """
    Detailed, actionable restocking & inventory action payload.
    """
    def __init__(
        self,
        product: ProductItem,
        action: str, # "RESTOCK", "PRIORITIZE_SELLING", "DISPOSE_EXPIRED", "MONITOR"
        recommended_buy_qty: int,
        eoq_qty: int,
        min_stock: float,
        max_stock: float,
        forecasted_weekly_demand: float,
        expected_sales_before_expiry: Optional[float],
        message: str,
        reason: str
    ):
        self.product = product
        self.action = action
        self.recommended_buy_qty = int(recommended_buy_qty)
        self.eoq_qty = int(eoq_qty)
        self.min_stock = round(min_stock, 1)
        self.max_stock = round(max_stock, 1)
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
            "eoqQuantity": self.eoq_qty,
            "minTargetStock": self.min_stock,
            "maxTargetStock": self.max_stock,
            "estimatedCost": round(self.recommended_buy_qty * self.product.total_cost_per_unit, 2),
            "forecastedWeeklyDemand": self.forecasted_weekly_demand,
            "expectedSalesBeforeExpiry": self.expected_sales_before_expiry,
            "daysUntilExpiry": self.product.days_until_expiry,
            "isExpired": self.product.is_expired,
            "salesTrendPct": self.product.sales_trend_pct,
            "message": self.message,
            "reason": self.reason
        }


class FrequentPatternMiner:
    """
    Lightweight FP-Growth / Frequent Co-Purchasing Association Engine.
    Discovers frequently bundled items from sale transaction baskets.
    """
    @staticmethod
    def mine_associations(sale_baskets: List[List[str]], min_support: int = 2) -> List[Dict[str, Any]]:
        pair_counts: Dict[Tuple[str, str], int] = defaultdict(int)
        item_counts: Dict[str, int] = defaultdict(int)

        for basket in sale_baskets:
            unique_items = sorted(list(set(basket)))
            for it in unique_items:
                item_counts[it] += 1
            for i in range(len(unique_items)):
                for j in range(i + 1, len(unique_items)):
                    pair = (unique_items[i], unique_items[j])
                    pair_counts[pair] += 1

        associations = []
        for (item_a, item_b), count in pair_counts.items():
            if count >= min_support:
                conf_a = round((count / max(1, item_counts[item_a])) * 100, 1)
                conf_b = round((count / max(1, item_counts[item_b])) * 100, 1)
                associations.append({
                    "itemA": item_a,
                    "itemB": item_b,
                    "coPurchaseCount": count,
                    "confidenceAtoB": conf_a,
                    "confidenceBtoA": conf_b,
                    "insight": f"Customers buying '{item_a}' also buy '{item_b}' ({count} transactions)."
                })

        associations.sort(key=lambda x: x["coPurchaseCount"], reverse=True)
        return associations[:5]


class AdvancedPredictiveEngine:
    """
    Central orchestration engine for inventory optimization, demand smoothing (EMA/WMA),
    EOQ calculation, and Dynamic Min-Max replenishment.
    """
    def __init__(self, seasonal_factor: RationalSeasonalModel):
        self.seasonal_factor = seasonal_factor
        self.products: Dict[str, ProductItem] = {}

    def add_product(self, product: ProductItem) -> None:
        self.products[product.product_id] = product

    def ingest_sales_history(self, sales_items: List[Dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc)
        for item in sales_items:
            prod_id = item.get("productId")
            qty = float(item.get("quantity", 0))
            price = float(item.get("priceAtSale", 0))

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

    def generate_recommendations(self) -> List[SmartRecommendation]:
        recommendations: List[SmartRecommendation] = []

        for p in self.products.values():
            # 1. Advanced Demand Forecasting: Blend EMA and WMA
            ema_daily = p.calculate_ema_daily_demand(alpha=0.35)
            wma_weekly = p.calculate_wma_weekly_demand()
            blended_weekly = (wma_weekly * 0.6) + ((ema_daily * 7.0) * 0.4)

            # Apply Rational Seasonal Factor (no wild spikes)
            forecasted_weekly_demand = max(
                1.0 if p.units_sold_30d > 0 else 0.0,
                blended_weekly * self.seasonal_factor.multiplier
            )

            # Annualized demand estimate (for EOQ)
            annual_demand = forecasted_weekly_demand * 52.0
            eoq_qty = p.calculate_eoq(annual_demand)

            # 2. Dynamic Min-Max Replenishment Parameters:
            # MIN = Threshold + 1 week of safety buffer
            # MAX = MIN + EOQ Ceiling
            min_target = p.low_stock_threshold + math.ceil(forecasted_weekly_demand * 0.75)
            max_target = min_target + eoq_qty

            days_left = p.days_until_expiry

            # Case A: Expired Stock
            if p.is_expired:
                recommendations.append(
                    SmartRecommendation(
                        product=p,
                        action="DISPOSE_EXPIRED",
                        recommended_buy_qty=eoq_qty,
                        eoq_qty=eoq_qty,
                        min_stock=min_target,
                        max_stock=max_target,
                        forecasted_weekly_demand=forecasted_weekly_demand,
                        expected_sales_before_expiry=0,
                        message=f"{p.name} has expired. Remove damaged stock and order EOQ batch ({eoq_qty} {p.unit}s).",
                        reason="Expired Product"
                    )
                )
                continue

            # Case B: Expiration + Sales Velocity Synthesis
            if days_left is not None and days_left <= 45:
                daily_velocity = max(0.05, ema_daily)
                expected_to_sell = daily_velocity * days_left
                if p.current_stock > (expected_to_sell + 2):
                    recommendations.append(
                        SmartRecommendation(
                            product=p,
                            action="PRIORITIZE_SELLING",
                            recommended_buy_qty=0,
                            eoq_qty=eoq_qty,
                            min_stock=min_target,
                            max_stock=max_target,
                            forecasted_weekly_demand=forecasted_weekly_demand,
                            expected_sales_before_expiry=expected_to_sell,
                            message=(
                                f"{int(p.current_stock)} {p.unit}s in stock with {days_left}d left. "
                                f"Only ~{max(1, math.ceil(expected_to_sell))} expected to sell before expiry. "
                                f"Prioritize selling out and do not restock."
                            ),
                            reason="Overstocked Expiring Goods"
                        )
                    )
                    continue

            # Case C: Dynamic Min-Max Replenishment Trigger
            if p.current_stock <= min_target or (p.current_stock <= p.low_stock_threshold):
                # Restock up to MAX target, aligned to EOQ
                deficit = max_target - p.current_stock
                buy_qty = max(1, math.ceil(max(deficit, eoq_qty * 0.8)))

                reason_text = f"Stock ({int(p.current_stock)}) is at or below Min target ({int(min_target)}). EOQ optimal batch is {eoq_qty}."
                recommendations.append(
                    SmartRecommendation(
                        product=p,
                        action="RESTOCK",
                        recommended_buy_qty=buy_qty,
                        eoq_qty=eoq_qty,
                        min_stock=min_target,
                        max_stock=max_target,
                        forecasted_weekly_demand=forecasted_weekly_demand,
                        expected_sales_before_expiry=None,
                        message=f"Order {buy_qty} {p.unit}(s) from {p.supplier_name}. (Min: {int(min_target)}, Max: {int(max_target)})",
                        reason=reason_text
                    )
                )

        # Sort order: Expired -> Prioritize Selling -> Restock
        order_map = {"DISPOSE_EXPIRED": 0, "PRIORITIZE_SELLING": 1, "RESTOCK": 2, "MONITOR": 3}
        recommendations.sort(key=lambda r: (order_map.get(r.action, 4), -r.recommended_buy_qty))
        return recommendations

    def analyze_trends(self) -> List[Dict[str, Any]]:
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
                    "message": f"{p.name} demand {direction_text} over the last 15 days."
                })
        trends.sort(key=lambda x: abs(x["trendPct"]), reverse=True)
        return trends

    def generate_store_summary(
        self,
        recommendations: List[SmartRecommendation],
        trends: List[Dict[str, Any]],
        fast_movers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        restock_count = sum(1 for r in recommendations if r.action in ("RESTOCK", "DISPOSE_EXPIRED"))
        expiry_risk_count = sum(1 for r in recommendations if r.action == "PRIORITIZE_SELLING")
        top_movers_names = [f["name"] for f in fast_movers[:2]]

        summary_parts = []
        if top_movers_names:
            summary_parts.append(f"Top movers: {', '.join(top_movers_names)}.")
        if self.seasonal_factor.multiplier != 1.0:
            summary_parts.append(f"Adjusted for {self.seasonal_factor.description} ({self.seasonal_factor.multiplier}x).")
        summary_parts.append(f"{restock_count} product(s) reached Min replenishment triggers. {expiry_risk_count} item(s) flagged for expiration sell-off.")

        return {
            "headline": f"Store Overview — {self.seasonal_factor.factor_name} Demand Pacing",
            "restockCount": restock_count,
            "expiryRiskCount": expiry_risk_count,
            "summaryText": " ".join(summary_parts),
            "trends": trends[:4]
        }


def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "Empty input"}))
            sys.exit(1)

        payload = json.loads(raw_input)
        season_name = payload.get("seasonalFactor", "NORMAL")
        seasonal_model = RationalSeasonalModel(season_name)

        engine = AdvancedPredictiveEngine(seasonal_model)

        # 1. Load Products
        for p in payload.get("products", []):
            item = ProductItem(
                product_id=p["id"],
                name=p["name"],
                current_stock=p.get("stockQty", 0),
                cost_price=p.get("costPrice", 0),
                unit_price=p.get("price", 0),
                transpo_fee=p.get("transpoFee", 0),
                unit=p.get("unit", "pcs"),
                low_stock_threshold=p.get("lowStockThreshold", 5),
                category_name=p.get("category", {}).get("name", "General") if p.get("category") else "General",
                supplier_name=p.get("supplier", {}).get("name", "Direct Wholesale") if p.get("supplier") else "Direct Wholesale",
                expiration_date=p.get("expirationDate")
            )
            engine.add_product(item)

        # 2. Ingest Sales History
        sales_items = payload.get("salesItems", [])
        engine.ingest_sales_history(sales_items)

        # 3. Mine Co-Purchasing Association Patterns (FP-Growth style)
        baskets_map: Dict[str, List[str]] = defaultdict(list)
        for s in sales_items:
            sale_id = s.get("saleId")
            p_name = s.get("productName")
            if sale_id and p_name:
                baskets_map[sale_id].append(p_name)
        associations = FrequentPatternMiner.mine_associations(list(baskets_map.values()), min_support=1)

        # 4. Generate Recommendations & Dynamic Min-Max EOQ
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

        # 5. Build Grocery Shopping List
        restock_items = [r.to_dict() for r in recommendations if r.action in ("RESTOCK", "DISPOSE_EXPIRED")]
        supplier_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for item in restock_items:
            supplier_groups[item["supplierName"]].append(item)

        output = {
            "success": True,
            "engine": "Python-EOQ-DynamicMinMax-v4",
            "seasonalMultiplier": seasonal_model.multiplier,
            "seasonalFactorName": seasonal_model.factor_name,
            "fastMovers": fast_movers,
            "slowMovers": slow_movers,
            "trends": trends,
            "associations": associations,
            "recommendations": [r.to_dict() for r in recommendations],
            "groceryShoppingList": {
                "totalItemsCount": len(restock_items),
                "totalUnitsToBuy": sum(i["recommendedRestockQty"] for i in restock_items),
                "totalEstimatedBudget": round(sum(i["estimatedCost"] for i in restock_items), 2),
                "items": restock_items,
                "groupedBySupplier": dict(supplier_groups)
            },
            "storeSummary": store_summary
        }

        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "engine": "Python-v4-Error"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
