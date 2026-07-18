"""Normalize phone numbers to E.164 (SRS §10 rule 27). Defaults to Oman (+968)."""
import phonenumbers


def normalize_phone(raw, default_region="OM"):
    if not raw:
        return raw
    raw = str(raw).strip().replace(" ", "")
    try:
        parsed = phonenumbers.parse(raw, default_region)
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.E164
            )
    except phonenumbers.NumberParseException:
        pass
    # Fall back to a light normalization so demo/dev still works.
    if raw.startswith("00"):
        return "+" + raw[2:]
    if raw.startswith("0"):
        return "+968" + raw[1:]
    if not raw.startswith("+"):
        return "+" + raw
    return raw
