#!/usr/bin/env python3
"""
SARI 2 Predictive Analytics & Restocking Engine
Strict Object-Oriented Programming (OOP) implementation.
Calculates sales velocity, fast/slow movers, seasonal demand adjustments,
and generates expiration-aware grocery shopping lists.
"""

import sys
import json
import math
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any


class SeasonalMultiplier:
    """
    Represents an event or seasonal multiplier affecting store sales velocity.
    """
    PRESETS: Dict[str, float] = {
        "NORMAL": 1.0,
        "PAYDAY": 1.35,      # 15th / 30th salary cycle boost
        "FIESTA_HOLIDAY": 1.60, # Major holiday or barangay fiesta
        "RAINY_SEASON": 1.20,   # High demand for noodles, coffee, canned goods
        "WEEKEND": 1.15      # Regular weekend boost
    }

    def __init__(self, factor_name: str = "NORMAL", custom_multiplier: Optional[float] = None):
        if not isinstance(factor_name, str):
            raise TypeError(f"factor_name must be str, got {type(factor_name).__name__}")
        
        self.factor_name = factor_name.upper()
        if custom_multiplier is not None:
            if not isinstance(custom_multiplier, (int, float)) or custom_multiplier <= 0:
                raise ValueError("custom_multiplier must be a positive number")
            self.multiplier = float(custom_multiplier)
        else:
            self.multiplier = self.PRESETS.get(self.factor_name, 1.0)

    def __repr__(self) -> str:
        return f"<SeasonalMultiplier name='{self.factor_name}' multiplier={self.multiplier:.2f}>"


class ProductItem:
    """
    Encapsulates product telemetry, current stock, pricing, expiration, and supplier data.
    """
    def __init__(
        self,
        product_id: str,
        name: str,
        current_stock: float,
        unit_price: float,
        unit: str,
        low_stock_threshold: float,
        category_name: str,
        supplier_name: Optional[str] = None,
        expiration_date: Optional[str] = None
    ):
        if not isinstance(product_id, str) or not product_id.strip():
            raise ValueError("product_id must be a non-empty string")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("name must be a non-empty string")

        self.product_id: str = product_id
        self.name: str = name
        self.current_stock: float = float(current_stock)
        self.unit_price: float = float(unit_price)
        self.unit: str = unit or "pcs"
        self.low_stock_threshold: float = float(low_stock_threshold)
        self.category_name: str = category_name or "General"
        self.supplier_name: str = supplier_name or "Direct Wholesale"
        self.expiration_date: Optional[str] = expiration_date

        self.units_sold_30d: float = 0.0
        self.revenue_30d: float = 0.0

    @property
    def is_expired(self) -> bool:
        if not self.expiration_date:
            return False
        try:
            exp = datetime.fromisoformat(self.expiration_date.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            return exp < now
        except Exception:
            return False

    @property
    def days_until_expiry(self) -> Optional[int]:
        if not self.expiration_date:
            return None
        try:
            exp = datetime.fromisoformat(self.expiration_date.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            diff = exp - now
            return diff.days
        except Exception:
            return None

    def record_sale(self, quantity: float, price: float) -> None:
        if quantity < 0 or price < 0:
            raise ValueError("Sale quantity and price must be non-negative")
        self.units_sold_30d += float(quantity)
        self.revenue_30d += float(quantity) * float(price)

    def __repr__(self) -> str:
        return (
            f"<ProductItem id='{self.product_id}' name='{self.name}' "
            f"stock={self.current_stock}{self.unit} sold_30d={self.units_sold_30d}>"
        )


class RestockRecommendation:
    """
    Represents an actionable restocking recommendation item.
    """
    def __init__(
        self,
        product: ProductItem,
        forecasted_weekly_demand: float,
        recommended_buy_qty: int,
        reason: str
    ):
        self.product = product
        self.forecasted_weekly_demand = round(forecasted_weekly_demand, 1)
        self.recommended_buy_qty = int(recommended_buy_qty)
        self.reason = reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "productId": self.product.product_id,
            "productName": self.product.name,
            "categoryName": self.product.category_name,
            "supplierName": self.product.supplier_name,
            "currentStock": self.product.current_stock,
            "lowStockThreshold": self.product.low_stock_threshold,
            "unit": self.product.unit,
            "estimatedCost": round(self.recommended_buy_qty * self.product.unit_price, 2),
            "forecastedWeeklyDemand": self.forecasted_weekly_demand,
            "recommendedRestockQty": self.recommended_buy_qty,
            "reason": self.reason,
            "isExpired": self.product.is_expired,
            "daysUntilExpiry": self.product.days_until_expiry
        }

    def __repr__(self) -> str:
        return (
            f"<RestockRecommendation product='{self.product.name}' "
            f"buy={self.recommended_buy_qty} {self.product.unit} reason='{self.reason}'>"
        )


class DemandForecaster:
    """
    OOP analytics engine that executes 30-day moving-average forecasting,
    applies seasonal multipliers, and detects fast/slow-moving goods.
    """
    def __init__(self, seasonal_factor: SeasonalMultiplier):
        self.seasonal_factor: SeasonalMultiplier = seasonal_factor
        self.products: Dict[str, ProductItem] = {}

    def add_product(self, product: ProductItem) -> None:
        self.products[product.product_id] = product

    def ingest_sales_history(self, sales_items: List[Dict[str, Any]]) -> None:
        for item in sales_items:
            prod_id = item.get("productId")
            qty = float(item.get("quantity", 0))
            price = float(item.get("priceAtSale", 0))
            if prod_id in self.products:
                self.products[prod_id].record_sale(qty, price)

    def get_fast_movers(self, limit: int = 3) -> List[Dict[str, Any]]:
        sorted_prods = sorted(
            [p for p in self.products.values() if p.units_sold_30d > 0],
            key=lambda x: x.units_sold_30d,
            reverse=True
        )
        return [
            {
                "id": p.product_id,
                "name": p.name,
                "qty": p.units_sold_30d,
                "sales": round(p.revenue_30d, 2)
            }
            for p in sorted_prods[:limit]
        ]

    def get_slow_movers(self, limit: int = 3) -> List[Dict[str, Any]]:
        sorted_prods = sorted(
            list(self.products.values()),
            key=lambda x: x.units_sold_30d
        )
        return [
            {
                "id": p.product_id,
                "name": p.name,
                "qty": p.units_sold_30d,
                "sales": round(p.revenue_30d, 2)
            }
            for p in sorted_prods[:limit]
        ]

    def generate_recommendations(self) -> List[RestockRecommendation]:
        recommendations: List[RestockRecommendation] = []
        weeks_in_period = 30.0 / 7.0 # 4.28 weeks in a 30-day window

        for p in self.products.values():
            # Base weekly demand from 30-day velocity
            base_weekly_velocity = p.units_sold_30d / weeks_in_period
            
            # Apply seasonal / event multiplier
            adjusted_weekly_demand = base_weekly_velocity * self.seasonal_factor.multiplier
            
            # Safe buffer: at least 1 unit if sold, or min threshold
            forecasted_demand = max(
                1.0 if p.units_sold_30d > 0 else 0.0,
                adjusted_weekly_demand * 1.15 # 15% safety stock buffer
            )

            # Expiration-aware check: if product is expired, current stock is effectively 0
            effective_stock = 0.0 if p.is_expired else p.current_stock

            needs_restock = False
            reasons = []

            if p.is_expired:
                needs_restock = True
                reasons.append("Expired Stock Replacement")

            if effective_stock <= p.low_stock_threshold:
                needs_restock = True
                reasons.append(f"Below Threshold ({p.current_stock} <= {p.low_stock_threshold})")

            if effective_stock < forecasted_demand and p.units_sold_30d > 0:
                needs_restock = True
                reasons.append("High Demand Forecast")

            if needs_restock:
                # Target stock = 2 weeks of forecasted demand + threshold
                target_stock = math.ceil((forecasted_demand * 2.0) + p.low_stock_threshold)
                buy_qty = max(1, target_stock - int(effective_stock))

                recommendations.append(
                    RestockRecommendation(
                        product=p,
                        forecasted_weekly_demand=forecasted_demand,
                        recommended_buy_qty=buy_qty,
                        reason=" & ".join(reasons)
                    )
                )

        # Sort recommendations by urgency (expired and low stock first)
        recommendations.sort(
            key=lambda r: (
                0 if r.product.is_expired else (1 if r.product.current_stock <= r.product.low_stock_threshold else 2),
                -r.recommended_buy_qty
            )
        )
        return recommendations

    def __repr__(self) -> str:
        return f"<DemandForecaster tracking {len(self.products)} products | Season: {self.seasonal_factor}>"


class ShoppingListGenerator:
    """
    Transforms forecast recommendations into an actionable, itemized grocery shopping list.
    """
    @staticmethod
    def build_grocery_list(recommendations: List[RestockRecommendation]) -> Dict[str, Any]:
        items = [r.to_dict() for r in recommendations]
        total_estimated_budget = sum(item["estimatedCost"] for item in items)
        total_units_to_buy = sum(item["recommendedRestockQty"] for item in items)

        # Group by Supplier for easy buying
        supplier_groups: Dict[str, List[Dict[str, Any]]] = {}
        for item in items:
            sup = item["supplierName"]
            if sup not in supplier_groups:
                supplier_groups[sup] = []
            supplier_groups[sup].append(item)

        return {
            "totalItemsCount": len(items),
            "totalUnitsToBuy": total_units_to_buy,
            "totalEstimatedBudget": round(total_estimated_budget, 2),
            "items": items,
            "groupedBySupplier": supplier_groups
        }


def main():
    """
    Standard CLI interface to consume JSON from stdin or argument and output forecast results.
    """
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "Empty input payload"}))
            sys.exit(1)

        payload = json.loads(raw_input)
        
        season_name = payload.get("seasonalFactor", "NORMAL")
        seasonal_multiplier = SeasonalMultiplier(season_name)

        forecaster = DemandForecaster(seasonal_multiplier)

        # 1. Load Products
        for prod_data in payload.get("products", []):
            product = ProductItem(
                product_id=prod_data["id"],
                name=prod_data["name"],
                current_stock=prod_data.get("stockQty", 0),
                unit_price=prod_data.get("price", 0),
                unit=prod_data.get("unit", "pcs"),
                low_stock_threshold=prod_data.get("lowStockThreshold", 5),
                category_name=prod_data.get("category", {}).get("name", "General"),
                supplier_name=prod_data.get("supplier", {}).get("name", "Direct Wholesale") if prod_data.get("supplier") else "Direct Wholesale",
                expiration_date=prod_data.get("expirationDate")
            )
            forecaster.add_product(product)

        # 2. Ingest Sales History
        sales_items = payload.get("salesItems", [])
        forecaster.ingest_sales_history(sales_items)

        # 3. Compute Analytics
        fast_movers = forecaster.get_fast_movers(3)
        slow_movers = forecaster.get_slow_movers(3)
        recommendations = forecaster.generate_recommendations()
        shopping_list = ShoppingListGenerator.build_grocery_list(recommendations)

        output = {
            "success": True,
            "engine": "Python-OOP-v2",
            "seasonalMultiplier": seasonal_multiplier.multiplier,
            "seasonalFactorName": seasonal_multiplier.factor_name,
            "fastMovers": fast_movers,
            "slowMovers": slow_movers,
            "recommendations": [r.to_dict() for r in recommendations],
            "groceryShoppingList": shopping_list
        }

        print(json.dumps(output))
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "engine": "Python-OOP-v2-Error"
        }
        print(json.dumps(error_output))
        sys.exit(1)


if __name__ == "__main__":
    main()
