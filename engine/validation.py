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


def validate_request(payload):
    """Check the shape of a strategy request and return a normalised copy. Raises ValueError for malformed input.

    Missing sections become empty dictionaries; nothing is invented.
    """
    if not isinstance(payload, dict):
        raise ValueError("request body must be an object")
    out = dict(payload)
    for key in ("features", "farmer_context", "field_context", "weights", "constraints"):
        value = out.get(key)
        if value is None:
            out[key] = {}
        elif not isinstance(value, dict):
            raise ValueError(f"{key} must be an object")
    for key in ("rotation_history", "crop_history"):
        value = out["farmer_context"].get(key)
        if value is not None and not isinstance(value, list):
            raise ValueError(f"farmer_context.{key} must be a list")
    for key in ("available_crops", "unavailable_crops", "seed_available", "preferred_crops", "avoided_crops"):
        value = out["farmer_context"].get(key)
        if value is not None and not isinstance(value, list):
            raise ValueError(f"farmer_context.{key} must be a list")
    seed_access = out["constraints"].get("seed_access")
    if seed_access is not None and not isinstance(seed_access, dict):
        raise ValueError("constraints.seed_access must be an object")
    return out
