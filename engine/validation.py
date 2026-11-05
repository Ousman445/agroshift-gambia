def validate_field_data(field_data):
    """
    Check whether field data has the required structure.
    Missing values are not treated as zero.
    """

    errors = []

    if not isinstance(field_data, dict):
        return ["Field data must be a dictionary."]

    if not field_data.get("field_id"):
        errors.append("Missing field_id.")

    if not isinstance(field_data.get("features"), dict):
        errors.append("Missing or invalid features.")

    if not isinstance(field_data.get("location"), dict):
        errors.append("Missing or invalid location.")

    if errors:
        return errors

    required_features = [
        "rain_total_mm",
        "dry_spell_max_days",
        "dry_spells_ge7d",
        "ndvi_cover_nov_jun",
        "slope_pct",
        "soil_texture",
        "soc",
        "ph"
    ]

    features = field_data["features"]

    for feature in required_features:
        if feature not in features:
            errors.append(f"Missing feature: {feature}")

    return errors
