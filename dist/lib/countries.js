// ISO 3166-1 alpha-3 -> { a2, name, demonym } plus ICAO 9303 special codes.
// Used to turn MRZ country codes into values a web form will accept.
const TABLE = `
AFG|AF|Afghanistan|Afghan
ALA|AX|Åland Islands|
ALB|AL|Albania|Albanian
DZA|DZ|Algeria|Algerian
ASM|AS|American Samoa|American Samoan
AND|AD|Andorra|Andorran
AGO|AO|Angola|Angolan
AIA|AI|Anguilla|Anguillan
ATA|AQ|Antarctica|
ATG|AG|Antigua and Barbuda|Antiguan
ARG|AR|Argentina|Argentine
ARM|AM|Armenia|Armenian
ABW|AW|Aruba|Aruban
AUS|AU|Australia|Australian
AUT|AT|Austria|Austrian
AZE|AZ|Azerbaijan|Azerbaijani
BHS|BS|Bahamas|Bahamian
BHR|BH|Bahrain|Bahraini
BGD|BD|Bangladesh|Bangladeshi
BRB|BB|Barbados|Barbadian
BLR|BY|Belarus|Belarusian
BEL|BE|Belgium|Belgian
BLZ|BZ|Belize|Belizean
BEN|BJ|Benin|Beninese
BMU|BM|Bermuda|Bermudian
BTN|BT|Bhutan|Bhutanese
BOL|BO|Bolivia|Bolivian
BES|BQ|Bonaire, Sint Eustatius and Saba|
BIH|BA|Bosnia and Herzegovina|Bosnian
BWA|BW|Botswana|Botswanan
BVT|BV|Bouvet Island|
BRA|BR|Brazil|Brazilian
IOT|IO|British Indian Ocean Territory|
BRN|BN|Brunei Darussalam|Bruneian
BGR|BG|Bulgaria|Bulgarian
BFA|BF|Burkina Faso|Burkinabe
BDI|BI|Burundi|Burundian
CPV|CV|Cabo Verde|Cape Verdean
KHM|KH|Cambodia|Cambodian
CMR|CM|Cameroon|Cameroonian
CAN|CA|Canada|Canadian
CYM|KY|Cayman Islands|Caymanian
CAF|CF|Central African Republic|Central African
TCD|TD|Chad|Chadian
CHL|CL|Chile|Chilean
CHN|CN|China|Chinese
CXR|CX|Christmas Island|
CCK|CC|Cocos (Keeling) Islands|
COL|CO|Colombia|Colombian
COM|KM|Comoros|Comoran
COG|CG|Congo|Congolese
COD|CD|Congo, Democratic Republic of the|Congolese
COK|CK|Cook Islands|
CRI|CR|Costa Rica|Costa Rican
CIV|CI|Côte d'Ivoire|Ivorian
HRV|HR|Croatia|Croatian
CUB|CU|Cuba|Cuban
CUW|CW|Curaçao|
CYP|CY|Cyprus|Cypriot
CZE|CZ|Czechia|Czech
DNK|DK|Denmark|Danish
DJI|DJ|Djibouti|Djiboutian
DMA|DM|Dominica|Dominican
DOM|DO|Dominican Republic|Dominican
ECU|EC|Ecuador|Ecuadorian
EGY|EG|Egypt|Egyptian
SLV|SV|El Salvador|Salvadoran
GNQ|GQ|Equatorial Guinea|Equatorial Guinean
ERI|ER|Eritrea|Eritrean
EST|EE|Estonia|Estonian
SWZ|SZ|Eswatini|Swazi
ETH|ET|Ethiopia|Ethiopian
FLK|FK|Falkland Islands|
FRO|FO|Faroe Islands|Faroese
FJI|FJ|Fiji|Fijian
FIN|FI|Finland|Finnish
FRA|FR|France|French
GUF|GF|French Guiana|
PYF|PF|French Polynesia|
ATF|TF|French Southern Territories|
GAB|GA|Gabon|Gabonese
GMB|GM|Gambia|Gambian
GEO|GE|Georgia|Georgian
DEU|DE|Germany|German
GHA|GH|Ghana|Ghanaian
GIB|GI|Gibraltar|
GRC|GR|Greece|Greek
GRL|GL|Greenland|Greenlandic
GRD|GD|Grenada|Grenadian
GLP|GP|Guadeloupe|
GUM|GU|Guam|Guamanian
GTM|GT|Guatemala|Guatemalan
GGY|GG|Guernsey|
GIN|GN|Guinea|Guinean
GNB|GW|Guinea-Bissau|Bissau-Guinean
GUY|GY|Guyana|Guyanese
HTI|HT|Haiti|Haitian
HMD|HM|Heard Island and McDonald Islands|
VAT|VA|Holy See|
HND|HN|Honduras|Honduran
HKG|HK|Hong Kong|Hong Konger
HUN|HU|Hungary|Hungarian
ISL|IS|Iceland|Icelandic
IND|IN|India|Indian
IDN|ID|Indonesia|Indonesian
IRN|IR|Iran|Iranian
IRQ|IQ|Iraq|Iraqi
IRL|IE|Ireland|Irish
IMN|IM|Isle of Man|Manx
ISR|IL|Israel|Israeli
ITA|IT|Italy|Italian
JAM|JM|Jamaica|Jamaican
JPN|JP|Japan|Japanese
JEY|JE|Jersey|
JOR|JO|Jordan|Jordanian
KAZ|KZ|Kazakhstan|Kazakh
KEN|KE|Kenya|Kenyan
KIR|KI|Kiribati|I-Kiribati
PRK|KP|Korea, Democratic People's Republic of|North Korean
KOR|KR|Korea, Republic of|South Korean
KWT|KW|Kuwait|Kuwaiti
KGZ|KG|Kyrgyzstan|Kyrgyz
LAO|LA|Lao People's Democratic Republic|Lao
LVA|LV|Latvia|Latvian
LBN|LB|Lebanon|Lebanese
LSO|LS|Lesotho|Basotho
LBR|LR|Liberia|Liberian
LBY|LY|Libya|Libyan
LIE|LI|Liechtenstein|Liechtensteiner
LTU|LT|Lithuania|Lithuanian
LUX|LU|Luxembourg|Luxembourgish
MAC|MO|Macao|Macanese
MDG|MG|Madagascar|Malagasy
MWI|MW|Malawi|Malawian
MYS|MY|Malaysia|Malaysian
MDV|MV|Maldives|Maldivian
MLI|ML|Mali|Malian
MLT|MT|Malta|Maltese
MHL|MH|Marshall Islands|Marshallese
MTQ|MQ|Martinique|
MRT|MR|Mauritania|Mauritanian
MUS|MU|Mauritius|Mauritian
MYT|YT|Mayotte|
MEX|MX|Mexico|Mexican
FSM|FM|Micronesia, Federated States of|Micronesian
MDA|MD|Moldova, Republic of|Moldovan
MCO|MC|Monaco|Monegasque
MNG|MN|Mongolia|Mongolian
MNE|ME|Montenegro|Montenegrin
MSR|MS|Montserrat|
MAR|MA|Morocco|Moroccan
MOZ|MZ|Mozambique|Mozambican
MMR|MM|Myanmar|Burmese
NAM|NA|Namibia|Namibian
NRU|NR|Nauru|Nauruan
NPL|NP|Nepal|Nepalese
NLD|NL|Netherlands|Dutch
NCL|NC|New Caledonia|
NZL|NZ|New Zealand|New Zealander
NIC|NI|Nicaragua|Nicaraguan
NER|NE|Niger|Nigerien
NGA|NG|Nigeria|Nigerian
NIU|NU|Niue|
NFK|NF|Norfolk Island|
MKD|MK|North Macedonia|Macedonian
MNP|MP|Northern Mariana Islands|
NOR|NO|Norway|Norwegian
OMN|OM|Oman|Omani
PAK|PK|Pakistan|Pakistani
PLW|PW|Palau|Palauan
PSE|PS|Palestine, State of|Palestinian
PAN|PA|Panama|Panamanian
PNG|PG|Papua New Guinea|Papua New Guinean
PRY|PY|Paraguay|Paraguayan
PER|PE|Peru|Peruvian
PHL|PH|Philippines|Filipino
PCN|PN|Pitcairn|
POL|PL|Poland|Polish
PRT|PT|Portugal|Portuguese
PRI|PR|Puerto Rico|Puerto Rican
QAT|QA|Qatar|Qatari
REU|RE|Réunion|
ROU|RO|Romania|Romanian
RUS|RU|Russian Federation|Russian
RWA|RW|Rwanda|Rwandan
BLM|BL|Saint Barthélemy|
SHN|SH|Saint Helena, Ascension and Tristan da Cunha|
KNA|KN|Saint Kitts and Nevis|Kittitian
LCA|LC|Saint Lucia|Saint Lucian
MAF|MF|Saint Martin (French part)|
SPM|PM|Saint Pierre and Miquelon|
VCT|VC|Saint Vincent and the Grenadines|Vincentian
WSM|WS|Samoa|Samoan
SMR|SM|San Marino|Sammarinese
STP|ST|Sao Tome and Principe|Sao Tomean
SAU|SA|Saudi Arabia|Saudi
SEN|SN|Senegal|Senegalese
SRB|RS|Serbia|Serbian
SYC|SC|Seychelles|Seychellois
SLE|SL|Sierra Leone|Sierra Leonean
SGP|SG|Singapore|Singaporean
SXM|SX|Sint Maarten (Dutch part)|
SVK|SK|Slovakia|Slovak
SVN|SI|Slovenia|Slovenian
SLB|SB|Solomon Islands|Solomon Islander
SOM|SO|Somalia|Somali
ZAF|ZA|South Africa|South African
SGS|GS|South Georgia and the South Sandwich Islands|
SSD|SS|South Sudan|South Sudanese
ESP|ES|Spain|Spanish
LKA|LK|Sri Lanka|Sri Lankan
SDN|SD|Sudan|Sudanese
SUR|SR|Suriname|Surinamese
SJM|SJ|Svalbard and Jan Mayen|
SWE|SE|Sweden|Swedish
CHE|CH|Switzerland|Swiss
SYR|SY|Syrian Arab Republic|Syrian
TWN|TW|Taiwan|Taiwanese
TJK|TJ|Tajikistan|Tajik
TZA|TZ|Tanzania, United Republic of|Tanzanian
THA|TH|Thailand|Thai
TLS|TL|Timor-Leste|Timorese
TGO|TG|Togo|Togolese
TKL|TK|Tokelau|
TON|TO|Tonga|Tongan
TTO|TT|Trinidad and Tobago|Trinidadian
TUN|TN|Tunisia|Tunisian
TUR|TR|Türkiye|Turkish
TKM|TM|Turkmenistan|Turkmen
TCA|TC|Turks and Caicos Islands|
TUV|TV|Tuvalu|Tuvaluan
UGA|UG|Uganda|Ugandan
UKR|UA|Ukraine|Ukrainian
ARE|AE|United Arab Emirates|Emirati
GBR|GB|United Kingdom|British
USA|US|United States|American
UMI|UM|United States Minor Outlying Islands|
URY|UY|Uruguay|Uruguayan
UZB|UZ|Uzbekistan|Uzbek
VUT|VU|Vanuatu|Ni-Vanuatu
VEN|VE|Venezuela|Venezuelan
VNM|VN|Viet Nam|Vietnamese
VGB|VG|Virgin Islands, British|
VIR|VI|Virgin Islands, U.S.|
WLF|WF|Wallis and Futuna|
ESH|EH|Western Sahara|Sahrawi
YEM|YE|Yemen|Yemeni
ZMB|ZM|Zambia|Zambian
ZWE|ZW|Zimbabwe|Zimbabwean
`;

// Extra names a form may use for the same country (matched case-insensitively).
const ALIASES = {
  USA: ['United States of America', 'U.S.A.', 'U.S.', 'America'],
  GBR: ['Great Britain', 'UK', 'U.K.', 'Britain', 'England', 'United Kingdom of Great Britain and Northern Ireland'],
  KOR: ['South Korea', 'Korea', 'Republic of Korea', 'Korea (South)'],
  PRK: ['North Korea', 'Korea (North)'],
  RUS: ['Russia'],
  VNM: ['Vietnam'],
  CZE: ['Czech Republic'],
  TUR: ['Turkey'],
  IRN: ['Iran, Islamic Republic of'],
  SYR: ['Syria'],
  LAO: ['Laos'],
  MDA: ['Moldova'],
  TZA: ['Tanzania'],
  FSM: ['Micronesia'],
  PSE: ['Palestine'],
  VEN: ['Venezuela, Bolivarian Republic of'],
  BOL: ['Bolivia, Plurinational State of'],
  COD: ['DR Congo', 'Congo (Kinshasa)', 'Democratic Republic of the Congo'],
  COG: ['Congo (Brazzaville)', 'Republic of the Congo'],
  CIV: ['Ivory Coast', "Cote d'Ivoire"],
  CPV: ['Cape Verde'],
  SWZ: ['Swaziland'],
  MKD: ['Macedonia'],
  MMR: ['Burma'],
  TWN: ['Taiwan, Province of China', 'Chinese Taipei'],
  HKG: ['Hong Kong SAR', 'Hong Kong, China'],
  MAC: ['Macau'],
  NLD: ['The Netherlands', 'Holland'],
  BRN: ['Brunei'],
  VAT: ['Vatican City', 'Vatican'],
  BHS: ['The Bahamas'],
  GMB: ['The Gambia'],
  TLS: ['East Timor'],
  ARE: ['UAE', 'U.A.E.'],
  DEU: ['Deutschland'],
};

// ICAO 9303 codes that are not plain ISO alpha-3.
const SPECIAL = {
  D: 'DEU',
  GBD: 'GBR', GBN: 'GBR', GBO: 'GBR', GBP: 'GBR', GBS: 'GBR',
  RKS: { a2: 'XK', name: 'Kosovo', demonym: 'Kosovar' },
  EUE: { a2: 'EU', name: 'European Union', demonym: '' },
  UNO: { a2: 'UN', name: 'United Nations', demonym: '' },
  UNA: { a2: 'UN', name: 'United Nations', demonym: '' },
  UNK: { a2: 'UN', name: 'United Nations (Kosovo)', demonym: '' },
  XXA: { a2: '', name: 'Stateless', demonym: 'Stateless' },
  XXB: { a2: '', name: 'Refugee', demonym: 'Refugee' },
  XXC: { a2: '', name: 'Refugee (other)', demonym: 'Refugee' },
  XXX: { a2: '', name: 'Unspecified', demonym: '' },
};

const BY_A3 = new Map();
for (const line of TABLE.trim().split('\n')) {
  const [a3, a2, name, demonym] = line.split('|');
  BY_A3.set(a3, { a3, a2, name, demonym: demonym || '', aliases: ALIASES[a3] || [] });
}

/** Resolve an MRZ country code to { a3, a2, name, demonym, aliases }. Unknown codes return the code itself. */
export function resolveCountry(code) {
  if (!code) return null;
  const c = code.toUpperCase().replace(/</g, '');
  const special = SPECIAL[c];
  if (typeof special === 'string') return { ...BY_A3.get(special), a3: c };
  if (special) return { a3: c, aliases: [], ...special };
  return BY_A3.get(c) || { a3: c, a2: '', name: c, demonym: '', aliases: [] };
}
