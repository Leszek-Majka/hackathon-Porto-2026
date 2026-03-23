"""40-year LCC + carbon cost projection engine (pure math, no DB)."""


def compute_40yr_projections(assemblies: list[dict], params: dict) -> list[dict]:
    """Compute 40-year LCC + carbon cost projections."""
    study_period = params.get("study_period", 40)
    discount_rate = params.get("discount_rate", 0.03)
    energy_escalation = params.get("energy_escalation", 0.02)
    carbon_price = params.get("carbon_price", 300)  # $/tCO2e
    grid_factor = params.get("grid_factor", 0.074)  # kgCO2e/kWh, constant

    years = []
    cum_cost, cum_carbon, cum_carbon_cost = 0.0, 0.0, 0.0

    for y in range(study_period + 1):
        df = 1 / (1 + discount_rate) ** y
        annual = {
            "year": y,
            "capital": 0.0,
            "maintenance": 0.0,
            "replacement": 0.0,
            "energy": 0.0,
            "carbon_kg": 0.0,
        }

        for a in assemblies:
            vol = a.get("volume_m3", 0)
            gwp = a.get("gwp_kgco2e_m3", 0)
            cost_cap = a.get("cost_capital", 0)
            cost_maint = a.get("cost_maint_annual", 0)
            repl_year = a.get("replacement_year")
            repl_pct = a.get("replacement_pct", 0)
            energy_kwh = a.get("energy_impact_kwh", 0)

            if y == 0:
                annual["capital"] += cost_cap
                annual["carbon_kg"] += vol * gwp

            annual["maintenance"] += cost_maint

            if repl_year and y > 0 and y % repl_year == 0:
                annual["replacement"] += cost_cap * repl_pct
                annual["carbon_kg"] += vol * gwp * repl_pct

            energy_rate = 0.12 * (1 + energy_escalation) ** y
            annual["energy"] += energy_kwh * energy_rate

            annual["carbon_kg"] += energy_kwh * grid_factor

        annual["total_cost"] = round(
            annual["capital"] + annual["maintenance"] + annual["replacement"] + annual["energy"], 2
        )
        annual["total_cost_pv"] = round(annual["total_cost"] * df, 2)
        annual["carbon_t"] = round(annual["carbon_kg"] / 1000, 2)
        annual["carbon_cost"] = round(annual["carbon_t"] * carbon_price, 2)
        annual["carbon_cost_pv"] = round(annual["carbon_cost"] * df, 2)

        cum_cost += annual["total_cost_pv"]
        cum_carbon += annual["carbon_t"]
        cum_carbon_cost += annual["carbon_cost_pv"]

        annual["cum_cost"] = round(cum_cost, 2)
        annual["cum_carbon"] = round(cum_carbon, 2)
        annual["cum_carbon_cost"] = round(cum_carbon_cost, 2)
        years.append(annual)

    return years
