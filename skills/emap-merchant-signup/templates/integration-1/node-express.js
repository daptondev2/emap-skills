/**
 * EMAP Partner Integration 1 — Full 6-Step Form (Express.js backend)
 *
 * Install:  npm install express dotenv node-fetch@2
 *
 * .env file:
 *   EMAP_BASE_URL=https://emap.epd.dev
 *   EMAP_PARTNER_KEY=your_partner_key_here    # never commit this
 *   PORT=3000
 *
 * Run: node node-express.js
 *
 * Endpoints — dropdown data (public, cached):
 *   GET  /api/countries          → EMAP /api/partner/countries
 *   GET  /api/states             → EMAP /api/partner/states
 *   GET  /api/industry-types     → EMAP /api/partner/industry-types
 *   GET  /api/shopping-carts     → EMAP /api/partner/shopping-carts
 *   GET  /api/referral-sources   → EMAP /api/partner/referral-sources
 *   GET  /api/interest-details   → EMAP /api/partner/interest-details
 *
 * Endpoints — form steps (proxy to EMAP, partner_key injected server-side):
 *   POST /api/step/1             → EMAP POST /api/v1/signup
 *   POST /api/step/2             → EMAP POST /api/v1/application/step (step_count=2)
 *   POST /api/step/3             → EMAP POST /api/v1/application/step (step_count=3)
 *   POST /api/step/4             → EMAP POST /api/v1/ownership
 *   POST /api/step/5             → EMAP POST /api/v1/application/step (step_count=5)
 *   POST /api/step/6             → EMAP POST /api/v1/application/step (step_count=6)
 */

'use strict';
require('dotenv').config();

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const app     = express();

// ── Dropdown fallback data ────────────────────────────────────────
// Static snapshot of EMAP's public /api/partner/* dropdown endpoints, captured 2026-09-16.
// Used ONLY when the live call to EMAP fails, times out, or returns no usable data —
// so a dropdown never renders with zero options. This snapshot goes stale over time
// (EMAP can add/remove options); treat the live API as the source of truth and refresh
// this block periodically by re-running the GET requests in mode-1-fullform.md's
// "Dropdown APIs" table. Canonical copy also kept at references/dropdown-fallbacks.json.
const DROPDOWN_FALLBACKS = {
  "countries": {
    "success": true,
    "message": "Country list",
    "data": [
      {
        "name": "United States",
        "code": "US"
      },
      {
        "name": "Canada",
        "code": "CA"
      },
      {
        "name": "Puerto Rico",
        "code": "PR"
      },
      {
        "name": "Afghanistan",
        "code": "AF"
      },
      {
        "name": "Albania",
        "code": "AL"
      },
      {
        "name": "Algeria",
        "code": "DZ"
      },
      {
        "name": "American Samoa",
        "code": "AS"
      },
      {
        "name": "Andorra",
        "code": "AD"
      },
      {
        "name": "Angola",
        "code": "AO"
      },
      {
        "name": "Anguilla",
        "code": "AI"
      },
      {
        "name": "Antarctica",
        "code": "AQ"
      },
      {
        "name": "Antigua and Barbuda",
        "code": "AG"
      },
      {
        "name": "Argentina",
        "code": "AR"
      },
      {
        "name": "Armenia",
        "code": "AM"
      },
      {
        "name": "Aruba",
        "code": "AW"
      },
      {
        "name": "Australia",
        "code": "AU"
      },
      {
        "name": "Austria",
        "code": "AT"
      },
      {
        "name": "Azerbaijan",
        "code": "AZ"
      },
      {
        "name": "Bahamas",
        "code": "BS"
      },
      {
        "name": "Bahrain",
        "code": "BH"
      },
      {
        "name": "Bangladesh",
        "code": "BD"
      },
      {
        "name": "Barbados",
        "code": "BB"
      },
      {
        "name": "Belarus",
        "code": "BY"
      },
      {
        "name": "Belgium",
        "code": "BE"
      },
      {
        "name": "Belize",
        "code": "BZ"
      },
      {
        "name": "Benin",
        "code": "BJ"
      },
      {
        "name": "Bermuda",
        "code": "BM"
      },
      {
        "name": "Bhutan",
        "code": "BT"
      },
      {
        "name": "Bolivia",
        "code": "BO"
      },
      {
        "name": "Bonaire, Sint Eustatius and Saba",
        "code": "BQ"
      },
      {
        "name": "Bosnia and Herzegovina",
        "code": "BA"
      },
      {
        "name": "Botswana",
        "code": "BW"
      },
      {
        "name": "Bouvet Island",
        "code": "BV"
      },
      {
        "name": "Brazil",
        "code": "BR"
      },
      {
        "name": "British Indian Ocean Territory",
        "code": "IO"
      },
      {
        "name": "Brunei Darussalam",
        "code": "BN"
      },
      {
        "name": "Bulgaria",
        "code": "BG"
      },
      {
        "name": "Burkina Faso",
        "code": "BF"
      },
      {
        "name": "Burundi",
        "code": "BI"
      },
      {
        "name": "Cabo Verde",
        "code": "CV"
      },
      {
        "name": "Cambodia",
        "code": "KH"
      },
      {
        "name": "Cameroon",
        "code": "CM"
      },
      {
        "name": "Cayman Islands",
        "code": "KY"
      },
      {
        "name": "Central African Republic",
        "code": "CF"
      },
      {
        "name": "Chad",
        "code": "TD"
      },
      {
        "name": "Chile",
        "code": "CL"
      },
      {
        "name": "China",
        "code": "CN"
      },
      {
        "name": "Christmas Island",
        "code": "CX"
      },
      {
        "name": "Cocos Islands",
        "code": "CC"
      },
      {
        "name": "Colombia",
        "code": "CO"
      },
      {
        "name": "Comoros  ",
        "code": "KM"
      },
      {
        "name": "Congo",
        "code": "CG"
      },
      {
        "name": "Cook Islands  ",
        "code": "CK"
      },
      {
        "name": "Costa Rica",
        "code": "CR"
      },
      {
        "name": "Croatia",
        "code": "HR"
      },
      {
        "name": "Cuba",
        "code": "CU"
      },
      {
        "name": "Curaçao",
        "code": "CW"
      },
      {
        "name": "Cyprus",
        "code": "CY"
      },
      {
        "name": "Czechia",
        "code": "CZ"
      },
      {
        "name": "Côte d'Ivoire",
        "code": "CI"
      },
      {
        "name": "Denmark",
        "code": "DK"
      },
      {
        "name": "Djibouti",
        "code": "DJ"
      },
      {
        "name": "Dominica",
        "code": "DM"
      },
      {
        "name": "Dominican Republic",
        "code": "DO"
      },
      {
        "name": "Ecuador",
        "code": "EC"
      },
      {
        "name": "Egypt",
        "code": "EG"
      },
      {
        "name": "El Salvador",
        "code": "SV"
      },
      {
        "name": "Equatorial Guinea",
        "code": "GQ"
      },
      {
        "name": "Eritrea",
        "code": "ER"
      },
      {
        "name": "Estonia",
        "code": "EE"
      },
      {
        "name": "Eswatini",
        "code": "SZ"
      },
      {
        "name": "Ethiopia",
        "code": "ET"
      },
      {
        "name": "Falkland Islands [Malvinas]",
        "code": "FK"
      },
      {
        "name": "Faroe Islands",
        "code": "FO"
      },
      {
        "name": "Fiji",
        "code": "FJ"
      },
      {
        "name": "Finland",
        "code": "FI"
      },
      {
        "name": "France",
        "code": "FR"
      },
      {
        "name": "French Guiana",
        "code": "GF"
      },
      {
        "name": "French Polynesia",
        "code": "PF"
      },
      {
        "name": "French Sourn Territories",
        "code": "TF"
      },
      {
        "name": "Gabon",
        "code": "GA"
      },
      {
        "name": "Gambia",
        "code": "GM"
      },
      {
        "name": "Georgia",
        "code": "GE"
      },
      {
        "name": "Germany",
        "code": "DE"
      },
      {
        "name": "Ghana",
        "code": "GH"
      },
      {
        "name": "Gibraltar",
        "code": "GI"
      },
      {
        "name": "Greece",
        "code": "GR"
      },
      {
        "name": "Greenland",
        "code": "GL"
      },
      {
        "name": "Grenada",
        "code": "GD"
      },
      {
        "name": "Guadeloupe",
        "code": "GP"
      },
      {
        "name": "Guam",
        "code": "GU"
      },
      {
        "name": "Guatemala",
        "code": "GT"
      },
      {
        "name": "Guernsey",
        "code": "GG"
      },
      {
        "name": "Guinea",
        "code": "GN"
      },
      {
        "name": "Guinea-Bissau",
        "code": "GW"
      },
      {
        "name": "Guyana",
        "code": "GY"
      },
      {
        "name": "Haiti",
        "code": "HT"
      },
      {
        "name": "Heard Island and McDonald Islands",
        "code": "HM"
      },
      {
        "name": "Holy See",
        "code": "VA"
      },
      {
        "name": "Honduras",
        "code": "HN"
      },
      {
        "name": "Hong Kong",
        "code": "HK"
      },
      {
        "name": "Hungary",
        "code": "HU"
      },
      {
        "name": "Iceland",
        "code": "IS"
      },
      {
        "name": "India",
        "code": "IN"
      },
      {
        "name": "Indonesia",
        "code": "ID"
      },
      {
        "name": "Iran",
        "code": "IR"
      },
      {
        "name": "Iraq",
        "code": "IQ"
      },
      {
        "name": "Ireland",
        "code": "IE"
      },
      {
        "name": "Isle of Man",
        "code": "IM"
      },
      {
        "name": "Israel",
        "code": "IL"
      },
      {
        "name": "Italy",
        "code": "IT"
      },
      {
        "name": "Jamaica",
        "code": "JM"
      },
      {
        "name": "Japan",
        "code": "JP"
      },
      {
        "name": "Jersey",
        "code": "JE"
      },
      {
        "name": "Jordan",
        "code": "JO"
      },
      {
        "name": "Kazakhstan",
        "code": "KZ"
      },
      {
        "name": "Kenya",
        "code": "KE"
      },
      {
        "name": "Kiribati",
        "code": "KI"
      },
      {
        "name": "North Korea",
        "code": "KP"
      },
      {
        "name": "South Korea",
        "code": "KR"
      },
      {
        "name": "Kuwait",
        "code": "KW"
      },
      {
        "name": "Kyrgyzstan",
        "code": "KG"
      },
      {
        "name": "Lao People's Democratic Republic",
        "code": "LA"
      },
      {
        "name": "Latvia",
        "code": "LV"
      },
      {
        "name": "Lebanon",
        "code": "LB"
      },
      {
        "name": "Lesotho",
        "code": "LS"
      },
      {
        "name": "Liberia",
        "code": "LR"
      },
      {
        "name": "Libya",
        "code": "LY"
      },
      {
        "name": "Liechtenstein",
        "code": "LI"
      },
      {
        "name": "Lithuania",
        "code": "LT"
      },
      {
        "name": "Luxembourg",
        "code": "LU"
      },
      {
        "name": "Macao",
        "code": "MO"
      },
      {
        "name": "Madagascar",
        "code": "MG"
      },
      {
        "name": "Malawi",
        "code": "MW"
      },
      {
        "name": "Malaysia",
        "code": "MY"
      },
      {
        "name": "Maldives",
        "code": "MV"
      },
      {
        "name": "Mali",
        "code": "ML"
      },
      {
        "name": "Malta",
        "code": "MT"
      },
      {
        "name": "Marshall Islands",
        "code": "MH"
      },
      {
        "name": "Martinique",
        "code": "MQ"
      },
      {
        "name": "Mauritania",
        "code": "MR"
      },
      {
        "name": "Mauritius",
        "code": "MU"
      },
      {
        "name": "Mayotte",
        "code": "YT"
      },
      {
        "name": "Mexico",
        "code": "MX"
      },
      {
        "name": "Micronesia",
        "code": "FM"
      },
      {
        "name": "Moldova",
        "code": "MD"
      },
      {
        "name": "Monaco",
        "code": "MC"
      },
      {
        "name": "Mongolia",
        "code": "MN"
      },
      {
        "name": "Montenegro",
        "code": "ME"
      },
      {
        "name": "Montserrat",
        "code": "MS"
      },
      {
        "name": "Morocco",
        "code": "MA"
      },
      {
        "name": "Mozambique",
        "code": "MZ"
      },
      {
        "name": "Myanmar",
        "code": "MM"
      },
      {
        "name": "Namibia",
        "code": "NA"
      },
      {
        "name": "Nauru",
        "code": "NR"
      },
      {
        "name": "Nepal",
        "code": "NP"
      },
      {
        "name": "Netherlands",
        "code": "NL"
      },
      {
        "name": "New Caledonia",
        "code": "NC"
      },
      {
        "name": "New Zealand",
        "code": "NZ"
      },
      {
        "name": "Nicaragua",
        "code": "NI"
      },
      {
        "name": "Niger",
        "code": "NE"
      },
      {
        "name": "Nigeria",
        "code": "NG"
      },
      {
        "name": "Niue",
        "code": "NU"
      },
      {
        "name": "Norfolk Island",
        "code": "NF"
      },
      {
        "name": "Norrn Mariana Islands",
        "code": "MP"
      },
      {
        "name": "Norway",
        "code": "NO"
      },
      {
        "name": "Oman",
        "code": "OM"
      },
      {
        "name": "Pakistan",
        "code": "PK"
      },
      {
        "name": "Palau",
        "code": "PW"
      },
      {
        "name": "Palestine, State of",
        "code": "PS"
      },
      {
        "name": "Panama",
        "code": "PA"
      },
      {
        "name": "Papua New Guinea",
        "code": "PG"
      },
      {
        "name": "Paraguay",
        "code": "PY"
      },
      {
        "name": "Peru",
        "code": "PE"
      },
      {
        "name": "Philippines",
        "code": "PH"
      },
      {
        "name": "Pitcairn",
        "code": "PN"
      },
      {
        "name": "Poland",
        "code": "PL"
      },
      {
        "name": "Portugal",
        "code": "PT"
      },
      {
        "name": "Qatar",
        "code": "QA"
      },
      {
        "name": "Republic of North Macedonia",
        "code": "MK"
      },
      {
        "name": "Romania",
        "code": "RO"
      },
      {
        "name": "Russian Federation",
        "code": "RU"
      },
      {
        "name": "Rwanda",
        "code": "RW"
      },
      {
        "name": "Réunion",
        "code": "RE"
      },
      {
        "name": "Saint Barthélemy",
        "code": "BL"
      },
      {
        "name": "Saint Helena, Ascension and Tristan da Cunha",
        "code": "SH"
      },
      {
        "name": "Saint Kitts and Nevis",
        "code": "KN"
      },
      {
        "name": "Saint Lucia",
        "code": "LC"
      },
      {
        "name": "Saint Martin",
        "code": "MF"
      },
      {
        "name": "Saint Pierre and Miquelon",
        "code": "PM"
      },
      {
        "name": "Saint Vincent and  Grenadines",
        "code": "VC"
      },
      {
        "name": "Samoa",
        "code": "WS"
      },
      {
        "name": "San Marino",
        "code": "SM"
      },
      {
        "name": "Sao Tome and Principe",
        "code": "ST"
      },
      {
        "name": "Saudi Arabia",
        "code": "SA"
      },
      {
        "name": "Senegal",
        "code": "SN"
      },
      {
        "name": "Serbia",
        "code": "RS"
      },
      {
        "name": "Seychelles",
        "code": "SC"
      },
      {
        "name": "Sierra Leone",
        "code": "SL"
      },
      {
        "name": "Singapore",
        "code": "SG"
      },
      {
        "name": "Sint Maarten",
        "code": "SX"
      },
      {
        "name": "Slovakia",
        "code": "SK"
      },
      {
        "name": "Slovenia",
        "code": "SI"
      },
      {
        "name": "Solomon Islands",
        "code": "SB"
      },
      {
        "name": "Somalia",
        "code": "SO"
      },
      {
        "name": "South Africa",
        "code": "ZA"
      },
      {
        "name": "South Georgia and South Sandwich Islands",
        "code": "GS"
      },
      {
        "name": "South Sudan",
        "code": "SS"
      },
      {
        "name": "Spain",
        "code": "ES"
      },
      {
        "name": "Sri Lanka",
        "code": "LK"
      },
      {
        "name": "Sudan",
        "code": "SD"
      },
      {
        "name": "Suriname",
        "code": "SR"
      },
      {
        "name": "Svalbard and Jan Mayen",
        "code": "SJ"
      },
      {
        "name": "Sweden",
        "code": "SE"
      },
      {
        "name": "Switzerland",
        "code": "CH"
      },
      {
        "name": "Syrian Arab Republic",
        "code": "SY"
      },
      {
        "name": "Taiwan",
        "code": "TW"
      },
      {
        "name": "Tajikistan",
        "code": "TJ"
      },
      {
        "name": "Tanzania, United Republic of",
        "code": "TZ"
      },
      {
        "name": "Thailand",
        "code": "TH"
      },
      {
        "name": "Timor-Leste",
        "code": "TL"
      },
      {
        "name": "Togo",
        "code": "TG"
      },
      {
        "name": "Tokelau",
        "code": "TK"
      },
      {
        "name": "Tonga",
        "code": "TO"
      },
      {
        "name": "Trinidad and Tobago",
        "code": "TT"
      },
      {
        "name": "Tunisia",
        "code": "TN"
      },
      {
        "name": "Turkey",
        "code": "TR"
      },
      {
        "name": "Turkmenistan",
        "code": "TM"
      },
      {
        "name": "Turks and Caicos Islands",
        "code": "TC"
      },
      {
        "name": "Tuvalu",
        "code": "TV"
      },
      {
        "name": "Uganda",
        "code": "UG"
      },
      {
        "name": "Ukraine",
        "code": "UA"
      },
      {
        "name": "United Arab Emirates",
        "code": "AE"
      },
      {
        "name": "United Kingdom",
        "code": "GB"
      },
      {
        "name": "United States Minor Outlying Islands",
        "code": "UM"
      },
      {
        "name": "Uruguay",
        "code": "UY"
      },
      {
        "name": "Uzbekistan",
        "code": "UZ"
      },
      {
        "name": "Vanuatu",
        "code": "VU"
      },
      {
        "name": "Venezuela",
        "code": "VE"
      },
      {
        "name": "Viet Nam",
        "code": "VN"
      },
      {
        "name": "Virgin Islands",
        "code": "VG"
      },
      {
        "name": "Virgin Islands",
        "code": "VI"
      },
      {
        "name": "Wallis and Futuna",
        "code": "WF"
      },
      {
        "name": "Western Sahara",
        "code": "EH"
      },
      {
        "name": "Yemen",
        "code": "YE"
      },
      {
        "name": "Zambia",
        "code": "ZM"
      },
      {
        "name": "Zimbabwe",
        "code": "ZW"
      },
      {
        "name": "Åland Islands",
        "code": "AX"
      },
      {
        "name": "Tedlandia",
        "code": null
      }
    ]
  },
  "states": {
    "success": true,
    "message": "US State List",
    "data": [
      {
        "name": "Alaska",
        "code": "AK"
      },
      {
        "name": "Alabama",
        "code": "AL"
      },
      {
        "name": "American Samoa",
        "code": "AS"
      },
      {
        "name": "Arizona",
        "code": "AZ"
      },
      {
        "name": "Arkansas",
        "code": "AR"
      },
      {
        "name": "California",
        "code": "CA"
      },
      {
        "name": "Colorado",
        "code": "CO"
      },
      {
        "name": "Connecticut",
        "code": "CT"
      },
      {
        "name": "Delaware",
        "code": "DE"
      },
      {
        "name": "District of Columbia",
        "code": "DC"
      },
      {
        "name": "Federated States of Micronesia",
        "code": "FM"
      },
      {
        "name": "Florida",
        "code": "FL"
      },
      {
        "name": "Georgia",
        "code": "GA"
      },
      {
        "name": "Guam",
        "code": "GU"
      },
      {
        "name": "Hawaii",
        "code": "HI"
      },
      {
        "name": "Idaho",
        "code": "ID"
      },
      {
        "name": "Illinois",
        "code": "IL"
      },
      {
        "name": "Indiana",
        "code": "IN"
      },
      {
        "name": "Iowa",
        "code": "IA"
      },
      {
        "name": "Kansas",
        "code": "KS"
      },
      {
        "name": "Kentucky",
        "code": "KY"
      },
      {
        "name": "Louisiana",
        "code": "LA"
      },
      {
        "name": "Maine",
        "code": "ME"
      },
      {
        "name": "Marshall Islands",
        "code": "MH"
      },
      {
        "name": "Maryland",
        "code": "MD"
      },
      {
        "name": "Massachusetts",
        "code": "MA"
      },
      {
        "name": "Michigan",
        "code": "MI"
      },
      {
        "name": "Minnesota",
        "code": "MN"
      },
      {
        "name": "Mississippi",
        "code": "MS"
      },
      {
        "name": "Missouri",
        "code": "MO"
      },
      {
        "name": "Montana",
        "code": "MT"
      },
      {
        "name": "Nebraska",
        "code": "NE"
      },
      {
        "name": "Nevada",
        "code": "NV"
      },
      {
        "name": "New Hampshire",
        "code": "NH"
      },
      {
        "name": "New Jersey",
        "code": "NJ"
      },
      {
        "name": "New Mexico",
        "code": "NM"
      },
      {
        "name": "New York",
        "code": "NY"
      },
      {
        "name": "North Carolina",
        "code": "NC"
      },
      {
        "name": "North Dakota",
        "code": "ND"
      },
      {
        "name": "Northern Mariana Islands",
        "code": "MP"
      },
      {
        "name": "Ohio",
        "code": "OH"
      },
      {
        "name": "Oklahoma",
        "code": "OK"
      },
      {
        "name": "Oregon",
        "code": "OR"
      },
      {
        "name": "Palau",
        "code": "PW"
      },
      {
        "name": "Pennsylvania",
        "code": "PA"
      },
      {
        "name": "Puerto Rico",
        "code": "PR"
      },
      {
        "name": "Rhode Island",
        "code": "RI"
      },
      {
        "name": "South Carolina",
        "code": "SC"
      },
      {
        "name": "South Dakota",
        "code": "SD"
      },
      {
        "name": "Tennessee",
        "code": "TN"
      },
      {
        "name": "Texas",
        "code": "TX"
      },
      {
        "name": "Utah",
        "code": "UT"
      },
      {
        "name": "Vermont",
        "code": "VT"
      },
      {
        "name": "Virgin Islands",
        "code": "VI"
      },
      {
        "name": "Virginia",
        "code": "VA"
      },
      {
        "name": "Washington",
        "code": "WA"
      },
      {
        "name": "West Virginia",
        "code": "WV"
      },
      {
        "name": "Wisconsin",
        "code": "WI"
      },
      {
        "name": "Wyoming",
        "code": "WY"
      },
      {
        "name": "Armed Forces Africa",
        "code": "AE"
      },
      {
        "name": "Armed Forces Americas (except Canada)",
        "code": "AA"
      },
      {
        "name": "Armed Forces Canada",
        "code": "AE"
      },
      {
        "name": "Armed Forces Europe",
        "code": "AE"
      },
      {
        "name": "Armed Forces Middle East",
        "code": "AE"
      },
      {
        "name": "Armed Forces Pacific",
        "code": "AP"
      }
    ]
  },
  "industry_types": {
    "success": true,
    "message": "Industry types list",
    "data": [
      {
        "name": "Adult - Dating Memberships",
        "slug": "adult-dating-memberships"
      },
      {
        "name": "Adult - Events",
        "slug": "Adult-Events"
      },
      {
        "name": "Adult - Online Memberships",
        "slug": "Adult-Online-Memberships"
      },
      {
        "name": "Adult - Other",
        "slug": "Adult-Other"
      },
      {
        "name": "Aggregators",
        "slug": "Aggregators"
      },
      {
        "name": "Alternative Health Practices - Information Product",
        "slug": "Alternative-Health-Practices-Information-Product"
      },
      {
        "name": "Automotive",
        "slug": "automotive"
      },
      {
        "name": "Bike Manufacturing",
        "slug": "bike-manufacturing"
      },
      {
        "name": "Biz-Op",
        "slug": "Biz-Op"
      },
      {
        "name": "Book Publishing",
        "slug": "book-publishing"
      },
      {
        "name": "Bowling Alleys",
        "slug": "bowling-alleys"
      },
      {
        "name": "Business & Legal  Consultation",
        "slug": "Business-Legal-Consultation"
      },
      {
        "name": "Business Coaching - Information Product",
        "slug": "Business-Coaching-Information-Product"
      },
      {
        "name": "Car Pooling",
        "slug": "Car-Pooling"
      },
      {
        "name": "Car Rental",
        "slug": "Car-rental"
      },
      {
        "name": "CBD",
        "slug": "cbd"
      },
      {
        "name": "Charity",
        "slug": "Charity"
      },
      {
        "name": "Cigars and Accessories",
        "slug": "Cigars-and-Accessories"
      },
      {
        "name": "Clothing/Jewelry",
        "slug": "Clothing-Jewelry"
      },
      {
        "name": "Credit Repair - Information Product",
        "slug": "Credit-Repair-Information-Product"
      },
      {
        "name": "Credit Repair - Service",
        "slug": "Credit-Repair-Service"
      },
      {
        "name": "Dating/Relationship - Informational Product",
        "slug": "Dating-Relationship-Informational-Product"
      },
      {
        "name": "Directory Listing",
        "slug": "Directory-Listing"
      },
      {
        "name": "Discount Buying Club",
        "slug": "Discount-Buying-Club"
      },
      {
        "name": "E-Books",
        "slug": "E-Books"
      },
      {
        "name": "eCommerce - Jewelry",
        "slug": "ecommerce-jewelry"
      },
      {
        "name": "Energy & Utilities",
        "slug": "energy-utilities"
      },
      {
        "name": "Entertainment & Media",
        "slug": "entertainment-media"
      },
      {
        "name": "Event Management (Live Events)",
        "slug": "Event-Management(Live-Events)"
      },
      {
        "name": "Fantasy Sports",
        "slug": "Fantasy-Sports"
      },
      {
        "name": "Financial Services - Other",
        "slug": "Financial-Services-Other"
      },
      {
        "name": "Financial Services - Remittance",
        "slug": "Financial-Services-Remittance"
      },
      {
        "name": "Financial/Wealth Education - Informational Product",
        "slug": "Financial-Wealth-Education-Informational-Product"
      },
      {
        "name": "Firearms",
        "slug": "Firearms"
      },
      {
        "name": "Gaming - Other",
        "slug": "Gaming-Other"
      },
      {
        "name": "Grocery Stores",
        "slug": "grocery-stores"
      },
      {
        "name": "Health - Fitness Information",
        "slug": "Health-Fitness-Information"
      },
      {
        "name": "Health - Other Information",
        "slug": "Health-Other-Information"
      },
      {
        "name": "ID Background Check",
        "slug": "ID-Background-Check"
      },
      {
        "name": "Information Product (Misc)",
        "slug": "information-product-misc"
      },
      {
        "name": "IT Services - Cloud Storage",
        "slug": "IT-Services-Cloud-Storage"
      },
      {
        "name": "IT Services - Marketing",
        "slug": "IT-Services-Marketing"
      },
      {
        "name": "Kratom",
        "slug": "Kratom"
      },
      {
        "name": "Liquor/Package Stores",
        "slug": "liquorpackage-stores"
      },
      {
        "name": "Magazine Subscriptions",
        "slug": "Magazine-Subscriptions"
      },
      {
        "name": "Marijuana / Cannabis",
        "slug": "Marijuana-Cannabis"
      },
      {
        "name": "Marketing - Advertising Agency FULL SERVICE",
        "slug": "Marketing-Advertising-Agency-FULL-SERVICE"
      },
      {
        "name": "Marketing - Business Opportunity (Lead Gen)",
        "slug": "Marketing-Business-Opportunity(Lead-Gen)"
      },
      {
        "name": "Marketing - Printing Services",
        "slug": "Marketing-Printing-Services"
      },
      {
        "name": "Marketing - SEO Services",
        "slug": "marketing-seo-services"
      },
      {
        "name": "Marketing - Web Design & Digital Services ONLY",
        "slug": "Marketing-Web-Design-Digital-Services-ONLY"
      },
      {
        "name": "Medical Services",
        "slug": "Medical-Services"
      },
      {
        "name": "MLM",
        "slug": "MLM"
      },
      {
        "name": "Movie Theaters",
        "slug": "movie-theaters"
      },
      {
        "name": "Musical Instruction - Information Product",
        "slug": "Musical-Instruction-Information-Product"
      },
      {
        "name": "Non-Profit",
        "slug": "Non-Profit"
      },
      {
        "name": "Nutraceutical - Beauty",
        "slug": "Nutraceutical-Beauty"
      },
      {
        "name": "Nutraceutical - Diet",
        "slug": "Nutraceutical-Diet"
      },
      {
        "name": "Nutraceutical - Diet Memberships (Trial/Recurring)",
        "slug": "Nutraceutical-Diet-Memberships(Trial/Recurring)"
      },
      {
        "name": "Nutraceutical - Male Enhancement",
        "slug": "Nutraceutical-Male-Enhancement"
      },
      {
        "name": "Nutraceutical - Muscle",
        "slug": "Nutraceutical-Muscle"
      },
      {
        "name": "Nutraceutical - Other",
        "slug": "Nutraceutical-Other"
      },
      {
        "name": "Nutraceutical - Skin Care",
        "slug": "Nutraceutical-Skin-Care"
      },
      {
        "name": "Nutraceutical - Sports Nutrition",
        "slug": "Nutraceutical-Sports-Nutrition"
      },
      {
        "name": "Nutraceutical - Teeth Whitening",
        "slug": "Nutraceutical-Teeth-Whitening"
      },
      {
        "name": "Online Marketing Education - Informational Product",
        "slug": "Online-Marketing-Education-Informational-Product"
      },
      {
        "name": "Other",
        "slug": "Other"
      },
      {
        "name": "Peptides Research",
        "slug": "peptides-research"
      },
      {
        "name": "Pet Care - Information Product",
        "slug": "Pet-Care-Information-Product"
      },
      {
        "name": "Physical Medical/Physicians",
        "slug": "physical-medicalphysicians"
      },
      {
        "name": "Psychics",
        "slug": "Psychics"
      },
      {
        "name": "Real Estate - Rent/Timeshares",
        "slug": "Real-Estate-Rent/Timeshares"
      },
      {
        "name": "Real Estate Education - Information Product",
        "slug": "Real-Estate-Education-Information-Product"
      },
      {
        "name": "Remote Tech Support - Accounting Services",
        "slug": "Remote-Tech-Support-Accounting-Services"
      },
      {
        "name": "Remote Tech Support - Other",
        "slug": "Remote-Tech-Support-Other"
      },
      {
        "name": "Remote Tech Support - PC Repair",
        "slug": "Remote-Tech-Support-PC-Repair"
      },
      {
        "name": "Remote Tech Support - SEO Services",
        "slug": "Remote-Tech-Support-SEO-Services"
      },
      {
        "name": "Restaurants",
        "slug": "Restaurants"
      },
      {
        "name": "Retail (eCommerce) - Art & Design",
        "slug": "Retail(eCommerce)-Art-Design"
      },
      {
        "name": "Retail (eCommerce) - Fashion",
        "slug": "Retail(eCommerce)-Fashion"
      },
      {
        "name": "Retail (eCommerce) - Furniture",
        "slug": "Retail(eCommerce)-Furniture"
      },
      {
        "name": "Retail (eCommerce) - Other",
        "slug": "Retail(eCommerce)-Other"
      },
      {
        "name": "Retail (eCommerce) - Sports Equipment",
        "slug": "Retail(eCommerce)-Sports-Equipment"
      },
      {
        "name": "Salon (independent hair stylist)",
        "slug": "Salon(independent-hair-stylist)"
      },
      {
        "name": "Salon (NOT independent stylist)",
        "slug": "Salon(NOT-independent-stylist)"
      },
      {
        "name": "SEO/Hosting",
        "slug": "SEO/Hosting"
      },
      {
        "name": "Smoking - E-Cigs & Vaporizers",
        "slug": "Smoking-E-Cigs-Vaporizers"
      },
      {
        "name": "Smoking - Herbals (K2, 'Potpourri', etc)",
        "slug": "Smoking-Herbals(K2,Potpourri,etc)"
      },
      {
        "name": "Smoking - Hookahs",
        "slug": "Smoking-Hookahs"
      },
      {
        "name": "Smoking - Marijuana",
        "slug": "Smoking-Marijuana"
      },
      {
        "name": "Smoking - Other",
        "slug": "Smoking-Other"
      },
      {
        "name": "Software As A Service (SAAS)",
        "slug": "Software-As-A-Service(SAAS)"
      },
      {
        "name": "Software Sales - Anti-Virus",
        "slug": "Software-Sales-Anti-Virus"
      },
      {
        "name": "Software Sales - Other",
        "slug": "Software-Sales-Other"
      },
      {
        "name": "Survival Prep",
        "slug": "Survival-Prep"
      },
      {
        "name": "Survival Prep - Information Product",
        "slug": "Survival-Prep-Information-Product"
      },
      {
        "name": "Test Industry",
        "slug": "test-industry"
      },
      {
        "name": "Travel - Cruise Bookings",
        "slug": "Travel-Cruise-Bookings"
      },
      {
        "name": "Travel - Hotel Bookings",
        "slug": "Travel-Hotel-Bookings"
      },
      {
        "name": "Travel - Travel Clubs (Discounts)",
        "slug": "Travel-Travel-Clubs(Discounts)"
      },
      {
        "name": "Travel - Travel Packages",
        "slug": "Travel-Travel-Packages"
      },
      {
        "name": "Virtual Assistants",
        "slug": "Virtual-Assistants"
      }
    ]
  },
  "shopping_carts": {
    "success": true,
    "message": "Shopping Cart List",
    "data": [
      {
        "name": "1Shopping Cart",
        "slug": "1Shopping Cart"
      },
      {
        "name": "3DCart",
        "slug": "3DCart"
      },
      {
        "name": "Americommerce",
        "slug": "Americommerce"
      },
      {
        "name": "API / Custom Integration",
        "slug": "API / Custom Integration"
      },
      {
        "name": "BigCommerce",
        "slug": "BigCommerce"
      },
      {
        "name": "Clickfunnels",
        "slug": "Clickfunnels"
      },
      {
        "name": "CoreCommerce",
        "slug": "CoreCommerce"
      },
      {
        "name": "CS-Cart",
        "slug": "CS-Cart"
      },
      {
        "name": "Ecwid.com",
        "slug": "Ecwid.com"
      },
      {
        "name": "Fortune3",
        "slug": "Fortune3"
      },
      {
        "name": "FoxyCart",
        "slug": "FoxyCart"
      },
      {
        "name": "GoHighLevel",
        "slug": "GoHighLevel"
      },
      {
        "name": "Goodsie",
        "slug": "Goodsie"
      },
      {
        "name": "I don't know, Other",
        "slug": "Other"
      },
      {
        "name": "I don't use one",
        "slug": "Not-Using"
      },
      {
        "name": "Infusionsoft/Keap",
        "slug": "Infusionsoft/Keap"
      },
      {
        "name": "Intuit",
        "slug": "Intuit"
      },
      {
        "name": "Jumpseller",
        "slug": "Jumpseller"
      },
      {
        "name": "Konnektive",
        "slug": "Konnektive"
      },
      {
        "name": "LemonStand",
        "slug": "LemonStand"
      },
      {
        "name": "Magento",
        "slug": "Magento"
      },
      {
        "name": "Miva Merchant",
        "slug": "Miva Merchant"
      },
      {
        "name": "Mobile Swiper",
        "slug": "Mobile Swiper"
      },
      {
        "name": "Moltin",
        "slug": "Moltin"
      },
      {
        "name": "Neto",
        "slug": "Neto"
      },
      {
        "name": "OntraPort",
        "slug": "OntraPort"
      },
      {
        "name": "PayKickStart",
        "slug": "PayKickStart"
      },
      {
        "name": "Physical-terminal",
        "slug": "Physical-terminal"
      },
      {
        "name": "PinnacleCart",
        "slug": "PinnacleCart"
      },
      {
        "name": "PrestaShop",
        "slug": "PrestaShop"
      },
      {
        "name": "QuickBooks",
        "slug": "QuickBooks"
      },
      {
        "name": "QuickClick",
        "slug": "QuickClick"
      },
      {
        "name": "SamCart",
        "slug": "SamCart"
      },
      {
        "name": "Shopify",
        "slug": "Shopify"
      },
      {
        "name": "Shopio",
        "slug": "Shopio"
      },
      {
        "name": "ShopVisible",
        "slug": "ShopVisible"
      },
      {
        "name": "Squarespace",
        "slug": "Squarespace"
      },
      {
        "name": "Supadupa.me",
        "slug": "Supadupa.me"
      },
      {
        "name": "ThriveCart",
        "slug": "ThriveCart"
      },
      {
        "name": "Tictail",
        "slug": "Tictail"
      },
      {
        "name": "UltraCart",
        "slug": "UltraCart"
      },
      {
        "name": "Volusion",
        "slug": "Volusion"
      },
      {
        "name": "WooCommerce",
        "slug": "WooCommerce"
      },
      {
        "name": "Yahoo Store",
        "slug": "Yahoo Store"
      },
      {
        "name": "zAbc",
        "slug": "zAbc"
      }
    ]
  },
  "referral_sources": {
    "success": true,
    "message": "Referral source list",
    "data": [
      {
        "name": "Bing",
        "slug": "Bing"
      },
      {
        "name": "Brad Weimert",
        "slug": "Brad"
      },
      {
        "name": "Forbes",
        "slug": "Forbes"
      },
      {
        "name": "Friend",
        "slug": "Friend"
      },
      {
        "name": "Google",
        "slug": "Google"
      },
      {
        "name": "Live Event / Trade Show",
        "slug": "Live-Event-/-Trade-Show"
      },
      {
        "name": "MMT",
        "slug": "MMT"
      },
      {
        "name": "Online Ad",
        "slug": "Online-Ad"
      },
      {
        "name": "Other",
        "slug": "Other"
      },
      {
        "name": "Pompa",
        "slug": "Pompa"
      },
      {
        "name": "Radio",
        "slug": "Radio"
      },
      {
        "name": "TechCrunch",
        "slug": "TechCrunch"
      },
      {
        "name": "Television",
        "slug": "Television"
      },
      {
        "name": "Wall Street Journal",
        "slug": "Wall-Street-Journal"
      }
    ]
  },
  "interest_details": {
    "success": true,
    "message": "Interest list",
    "data": [
      {
        "group_name": "Business Growth",
        "interests": [
          {
            "id": 8,
            "name": "Capital to grow your business"
          },
          {
            "id": 12,
            "name": "Credible Business Coach"
          },
          {
            "id": 14,
            "name": "Merchant Financing"
          }
        ]
      },
      {
        "group_name": "Digital Marketing",
        "interests": [
          {
            "id": 11,
            "name": "Email Automation / CRMs"
          },
          {
            "id": 6,
            "name": "Marketing Help - DFY Services"
          },
          {
            "id": 3,
            "name": "Quick Website Development"
          }
        ]
      },
      {
        "group_name": "Payment Processing",
        "interests": [
          {
            "id": 2,
            "name": "ACH/eCheck Processing"
          },
          {
            "id": 1,
            "name": "Autoupdate Expired Cards"
          },
          {
            "id": 7,
            "name": "Decline Salvage Tools"
          },
          {
            "id": 10,
            "name": "Mobile Payments"
          }
        ]
      },
      {
        "group_name": "Revenue Management",
        "interests": [
          {
            "id": 4,
            "name": "Chargeback Assistance"
          },
          {
            "id": 5,
            "name": "Email invoicing"
          },
          {
            "id": 9,
            "name": "Online Shopping Cart"
          }
        ]
      }
    ]
  }
};
const FALLBACK_KEY_BY_PATH = {
  '/api/partner/countries':        'countries',
  '/api/partner/states':           'states',
  '/api/partner/industry-types':   'industry_types',
  '/api/partner/shopping-carts':   'shopping_carts',
  '/api/partner/referral-sources': 'referral_sources',
  '/api/partner/interest-details': 'interest_details',
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Security headers ─────────────────────────────────────────────────────────
app.use(function (req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ── Config ───────────────────────────────────────────────────────────────────
const EMAP_BASE_URL = process.env.EMAP_BASE_URL;
if (!EMAP_BASE_URL) throw new Error('EMAP_BASE_URL environment variable is required');

let emapOrigin;
try {
  emapOrigin = new URL(EMAP_BASE_URL).origin;
} catch {
  throw new Error('EMAP_BASE_URL is not a valid URL');
}

// ── Dropdown proxy helpers ────────────────────────────────────────────────────
function dropdownProxy(emapPath) {
  const fallbackKey = FALLBACK_KEY_BY_PATH[emapPath];
  return async function (req, res) {
    try {
      const response = await fetch(`${emapOrigin}${emapPath}`, {
        headers: { 'Accept': 'application/json' },
      });
      const data = await response.json();
      const isUsable = response.ok && Array.isArray(data && data.data) && data.data.length > 0;
      if (isUsable) {
        res.set('Cache-Control', 'public, max-age=3600');
        return res.json(data);
      }
      console.error(`Dropdown proxy: EMAP ${emapPath} returned unusable data (status ${response.status}); serving fallback.`);
    } catch (networkError) {
      console.error(`Dropdown proxy: EMAP ${emapPath} request failed (${networkError.message}); serving fallback.`);
    }
    // Live call failed or returned no usable options — serve the static fallback
    // snapshot instead of an empty dropdown. Do not cache this response.
    res.set('Cache-Control', 'no-store');
    return res.json(DROPDOWN_FALLBACKS[fallbackKey] || { data: [] });
  };
}

app.get('/api/countries',        dropdownProxy('/api/partner/countries'));
app.get('/api/states',           dropdownProxy('/api/partner/states'));
app.get('/api/industry-types',   dropdownProxy('/api/partner/industry-types'));
app.get('/api/shopping-carts',   dropdownProxy('/api/partner/shopping-carts'));
app.get('/api/referral-sources', dropdownProxy('/api/partner/referral-sources'));
app.get('/api/interest-details', dropdownProxy('/api/partner/interest-details'));

// ── Step proxy helper ─────────────────────────────────────────────────────────
async function proxyStep(emapPath, body, res) {
  let emapResponse, emapData;
  try {
    emapResponse = await fetch(`${emapOrigin}${emapPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    emapData = await emapResponse.json();
  } catch (networkError) {
    console.error('EMAP network error:', networkError.message);
    return res.status(502).json({
      status: false,
      message: 'EMAP is temporarily unavailable. Please try again.',
    });
  }

  if (emapResponse.status === 429) {
    return res.status(429).json({
      status: false,
      message: 'Too many requests. Please wait a few minutes and try again.',
    });
  }

  if (emapResponse.status >= 500) {
    console.error('EMAP API returned', emapResponse.status, 'for', emapPath);
    return res.status(502).json({
      status: false,
      message: 'EMAP is temporarily unavailable. Please try again.',
    });
  }

  return res.status(emapResponse.status).json(emapData);
}

// ── POST /api/step/1 ─── ExternalSignupRequest ───────────────────────────────
app.post('/api/step/1', async function (req, res) {
  // Honeypot — real users never fill this hidden field; bots often do.
  // Reject silently (fake success, no EMAP call) so the bot has no signal to adapt to.
  if (req.body._hp) {
    return res.status(200).json({ status: true, message: 'Success' });
  }

  const {
    first_name, last_name, email, phone,
    name, company_name,
    website, country, annual_sales, business_state,
    industry_type, industry_type_other, promo_code,
  } = req.body;

  // Basic server-side guard — EMAP validates fully; we just reject obviously empty calls
  const companyName = (name || company_name || '').trim();
  const required = { first_name, last_name, email, phone, website, country, annual_sales, industry_type };
  if (!companyName) required.name = '';

  const missing = Object.entries(required)
    .filter(([, v]) => !v || String(v).trim() === '')
    .map(([k]) => k);

  if (missing.length > 0) {
    const errors = {};
    missing.forEach(function (k) { errors[k] = [k.replace(/_/g, ' ') + ' is required']; });
    return res.status(422).json({ status: false, message: 'Validation failed', errors });
  }

  const payload = {
    first_name:    String(first_name).trim(),
    last_name:     String(last_name).trim(),
    email:         String(email).trim().toLowerCase(),
    phone:         String(phone).trim(),
    name:          companyName,
    website:       String(website).trim(),
    country:       String(country).trim().toUpperCase(),
    annual_sales:  Number(annual_sales),
    industry_type: String(industry_type).trim(),
  };

  if (business_state)      payload.business_state      = String(business_state).trim().toUpperCase();
  if (industry_type_other) payload.industry_type_other = String(industry_type_other).trim();
  if (promo_code)          payload.promo_code          = String(promo_code).trim();

  // Partner key from env only — never from the request body
  if (process.env.EMAP_PARTNER_KEY) payload.partner_key = process.env.EMAP_PARTNER_KEY;

  return proxyStep('/api/v1/signup', payload, res);
});

// ── POST /api/step/2 ─── ApplicationStepRequest (step_count=2) ───────────────
app.post('/api/step/2', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  // country_from_step1 is sent by the client for this check only (same pattern
  // as Step 5's bank validation below); it is never forwarded to EMAP (stripped
  // before proxying).
  const country = String(req.body.country_from_step1 || '').trim().toUpperCase();
  const businessOrganized = String(req.body.business_organized || '').trim();
  const isSoleProp = businessOrganized === 'Sole-Proprietorship';
  const errors = {};

  // federal_tax_id: required unless country=CA OR org=Sole-Proprietorship (OR —
  // matches manageFederalTaxId in EMAP's own variantA/step2 js.blade.php; the
  // schema's visibleIf.logic uses AND instead and is stale/wrong — see SKILL.md).
  const einRequired = !(country === 'CA' || isSoleProp);
  const ein = String(req.body.federal_tax_id || '').trim();
  if (einRequired) {
    if (!ein) {
      errors.federal_tax_id = ['Tax ID is required'];
    } else {
      // US/CA/PR: XXX-XX-XXXX (3-2-4); every other country: XX-XXXXXXX (2-7) —
      // matches Cleave.js formatConfig in manageFederalTaxIdFormat exactly.
      const isUsCaPr = country === 'US' || country === 'CA' || country === 'PR';
      const einPattern = isUsCaPr ? /^\d{3}-\d{2}-\d{4}$/ : /^\d{2}-\d{7}$/;
      if (!einPattern.test(ein)) {
        errors.federal_tax_id = [isUsCaPr
          ? 'Tax ID must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'
          : 'Tax ID must be in the format XX-XXXXXXX (e.g. 12-3456789)'];
      }
    }
  }

  // business_register_number: required unless country=US, country=PR, OR
  // (country=CA AND org=Sole-Proprietorship) — matches manageBusinessRegistrationNumber
  // exactly (not just "non-US").
  const regRequired = !(country === 'US' || country === 'PR' || (country === 'CA' && isSoleProp));
  const regNumber = String(req.body.business_register_number || '').trim();
  if (regRequired && !regNumber) {
    errors.business_register_number = ['Business registration number is required'];
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ status: false, message: 'Validation failed', errors });
  }

  const payload = Object.assign({}, req.body, { step_count: 2 });
  delete payload.country_from_step1;
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── POST /api/step/3 ─── ApplicationStepRequest (step_count=3) ───────────────
app.post('/api/step/3', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  const payload = Object.assign({}, req.body, { step_count: 3 });
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── POST /api/step/4 ─── HandleOwnershipRequest ───────────────────────────────
app.post('/api/step/4', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  // SSN/SIN — nested as { ssn: { '1': '...', '2': '...' } } from the client toNestedDot
  // helper. Format is keyed off country_from_step1 (the single Step 1 formation
  // country, sent by the client for this check only and never forwarded to EMAP),
  // applied identically to BOTH owners — NOT each owner's own country.1/country.2
  // (home address/residence, used only for driver's license gating). Matches
  // EMAP's own variantA/step4 js.blade.php exactly: selectedCountry = $company->country
  // drives both owner_ssn Cleave masks and validateSSN() there.
  const SSN_RE = /^\d{3}-\d{2}-\d{4}$/;
  const ssnObj = req.body.ssn || {};
  const ssnCountry = String(req.body.country_from_step1 || '').trim().toUpperCase();
  const ssnNeedsFormat = ssnCountry === 'US' || ssnCountry === 'CA' || ssnCountry === 'PR';
  const errors = {};

  ['1', '2'].forEach(function (n) {
    if (ssnObj[n] !== undefined) {
      const val = String(ssnObj[n]).trim();
      if (!val) {
        errors['ssn.' + n] = ['SSN/SIN is required'];
      } else if (ssnNeedsFormat && !SSN_RE.test(val)) {
        errors['ssn.' + n] = ['SSN/SIN must be in the format XXX-XX-XXXX (e.g. 123-45-6789)'];
      }
    }
  });

  // DOB — owner must be between 18 and 100 years old (nested as { dob: { '1': ..., '2': ... } })
  const dobObj = req.body.dob || {};
  ['1', '2'].forEach(function (n) {
    if (dobObj[n] !== undefined && dobObj[n] !== '') {
      const val = String(dobObj[n]).trim();
      const dob = new Date(val);
      if (isNaN(dob.getTime())) {
        errors['dob.' + n] = ['Date of birth is invalid'];
        return;
      }
      const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 18) {
        errors['dob.' + n] = ['Owner must be at least 18 years old'];
      } else if (ageYears > 100) {
        errors['dob.' + n] = ['Please enter a valid date of birth'];
      }
    }
  });

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ status: false, message: 'Validation failed', errors });
  }

  const ownershipPayload = Object.assign({}, req.body);
  delete ownershipPayload.country_from_step1;
  return proxyStep('/api/v1/ownership', ownershipPayload, res);
});

// ── POST /api/step/5 ─── ApplicationStepRequest (step_count=5) ───────────────
app.post('/api/step/5', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  // Country-specific bank field validation — country_from_step1 is sent by the client for this
  // check only; it is never forwarded to EMAP (stripped below).
  const bankCountry = String(req.body.country_from_step1 || '').trim().toUpperCase();
  const routingNumber = String(req.body.routing_number || '').trim();
  const accountNumber = String(req.body.account_number || '').trim();
  if (bankCountry === 'US') {
    const errors = {};
    if (!/^\d{9}$/.test(routingNumber)) {
      errors.routing_number = ['US routing number must be exactly 9 digits'];
    }
    if (accountNumber.length < 8 || accountNumber.length > 17) {
      errors.account_number = ['US account number must be 8-17 characters'];
    }
    if (Object.keys(errors).length) {
      return res.status(422).json({ status: false, message: 'Validation failed', errors });
    }
  }

  const payload = Object.assign({}, req.body, { step_count: 5 });
  delete payload.country_from_step1;
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── POST /api/step/6 ─── ApplicationStepRequest (step_count=6) ───────────────
app.post('/api/step/6', async function (req, res) {
  const { uuid } = req.body;
  if (!uuid) return res.status(422).json({ status: false, message: 'uuid is required' });

  const payload = Object.assign({}, req.body, { step_count: 6 });
  return proxyStep('/api/v1/application/step', payload, res);
});

// ── Serve the form ────────────────────────────────────────────────────────────
app.get('/', function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'plain-html.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('EMAP Integration 1 server listening on port ' + PORT);
  console.log('EMAP origin:', emapOrigin);
  if (!process.env.EMAP_PARTNER_KEY) {
    console.warn('EMAP_PARTNER_KEY not set — signups will not be attributed to a partner');
  }
});
