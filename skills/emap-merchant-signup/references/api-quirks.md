# EMAP API quirks (Integration 1)

Behaviour of EMAP's API that the field names, the schema and EMAP's own signup page don't make
obvious. Each item was found by submitting to EMAP's **test server** (`https://emap.epd.dev`). The
short rules live in `SKILL.md`; this file explains why they exist.

If a rule here conflicts with EMAP's own signup page, follow this file: the API is what accepts or
rejects the submission, and the two have been seen to disagree.

---

## `federal_tax_id`: Canada and Sole-Proprietorship are exempt

The field is not required when the Step 1 country is `CA` **or** `business_organized` is
`Sole-Proprietorship`. This is EMAP's signup page rule, and the API's own error text says the same:

> "Federal tax ID (or equivalent) is required for all companies except Canada and
> Sole-Proprietorships"

Rule: hide, disable and un-require the field when either condition is true, and re-check whenever
either field changes.

Open issue: one earlier test submission of a US and a German Sole-Proprietorship without the field
was rejected with that same 422 message. The cause wasn't found. If real sole-prop merchants hit it,
EMAP's API needs to match its own message; the form follows the rule above.

The field is numeric only in every country: masked `XXX-XX-XXXX` for US/CA/PR and `XX-XXXXXXX`
elsewhere, despite its generic `^[0-9A-Za-z\-]+$` pattern and "EIN" placeholder. See its
`countryVariants` in the schema.

## `business_register_number`: only the US is exempt

EMAP's signup page also exempts Puerto Rico and Canadian Sole-Proprietorships. The API rejected a
Puerto Rico submission without it. Rule: hide and un-require it only when the Step 1 country is `US`.

## `visibleIf` and `dependsOn` can differ

For the same field, `visibleIf` controls whether it's shown and `dependsOn` whether it's required.
They are separate expressions and don't have to match. An older schema version had them disagree
for `federal_tax_id` (AND for visibility, OR for required); EMAP's page actually uses one OR rule for
both, and the schema has been corrected. Read both conditions from the schema for every conditional
field instead of assuming one follows the other.

## SSN format follows the Step 1 country, for both owners

`ssn.1` and `ssn.2` are both formatted from `country_from_step1`, the single Step 1 formation country.
They do not use each owner's own `country.1` / `country.2`, which are home-address countries used
only for the driver-licence fields. EMAP's page applies one mask to every owner SSN field.

## Referral source "tell us more" matches on text

`/api/partner/referral-sources` returns only `name` and `slug`, with no `id`. Show
`hear_about_us_other` by matching the slug or name (`Other`, `Friend`, `Live-Event-/-Trade-Show`).
An id-based check never fires.

## The "Other" industry slug is capitalised

`/api/partner/industry-types` returns the catch-all option's slug as `Other`. Compare it to `other`
case-insensitively, or `industry_type_other` never appears.

## Owner age isn't checked by the API

The API accepts any date of birth. The 18–100 rule exists only in the form (date `min`/`max` plus a
submit-time check). Someone calling the API directly can bypass it; that needs a fix on EMAP's side,
not in the form.

## Dropdown data can contain unusable rows

The test server's data includes rows with no usable value, such as a country whose `code` is `null`.
The templates drop rows whose `code` (countries, states) or `slug` (industry types, shopping carts,
referral sources) is empty, for live data and for the fallback snapshot.

---

## Testing against the live API

`verify_form.py` catches a mismatch between the schema and the code. It can't catch both being wrong
about the API, which is how the items above were found. When a change touches one of these rules,
submit a representative case (for example a German Sole-Proprietorship) to the **test server** with
an email address you control. Never create test applications on EMAP's production server.
