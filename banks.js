// ================================================================
// BANKS.JS — GCC BANK REGISTRY
// Contains UAE_BANKS and GCC_BANKS registries
// Source: Official central bank routing codes and SWIFT registry
// ================================================================
 
// ================================================================
// UAE BANK REGISTRY
// Bank code = digits 5-7 of UAE IBAN (after AE + 2 check digits)
// Example: AE07 [033] xxxxxxxxxxxxxxxx → bank code = 033 (Mashreq)
// ================================================================
const UAE_BANKS = {
  "001": { name: "Central Bank of UAE (CBUAE)", swift: "CBAUAEAAXXX", address: "Central Bank Building, Corniche Road, Abu Dhabi, UAE" },
  "002": { name: "The Royal Bank of Scotland N.V. (ABN AMRO)", swift: "ABNAAEAAXXX", address: "Sheikh Zayed Road, Dubai, UAE" },
  "003": { name: "Abu Dhabi Commercial Bank (ADCB)", swift: "ADCBAEAAXXX", address: "ADCB Building, Sheikh Zayed Road, Abu Dhabi, UAE" },
  "004": { name: "Al Ahli Bank of Kuwait K.S.C. (ABK)", swift: "ABKKAEADXXX", address: "Khalid Bin Al Walid Road, Dubai, UAE" },
  "005": { name: "Rafidain Bank (Rafidain)", swift: "RAFBAEADXXX", address: "Dubai, UAE" },
  "007": { name: "Arab African International Bank (AAIB)", swift: "ARAIAEADXXX", address: "Deira, Dubai, UAE" },
  "008": { name: "Al Masraf (Arab Bank for Investment & Foreign Trade)", swift: "ABINAEAAXXX", address: "Al Masraf Tower, Hamdan Street, Abu Dhabi, UAE" },
  "009": { name: "Arab Bank (Arab Bank)", swift: "ARABAEADXXX", address: "Baniyas Road, Deira, Dubai, UAE" },
  "010": { name: "Bank Melli Iran (BMI)", swift: "MELIAEADXXX", address: "Al Maktoum Road, Deira, Dubai, UAE" },
  "011": { name: "Bank of Baroda (BOB)", swift: "BARBAEADXXX", address: "Bank of Baroda Building, Baniyas Road, Dubai, UAE" },
  "012": { name: "Bank of Sharjah (BOS)", swift: "SHARAEASXXX", address: "Bank of Sharjah Building, Al Buhairah Corniche, Sharjah, UAE" },
  "013": { name: "Bank Saderat Iran (BSI)", swift: "BSIRAEADXXX", address: "Al Maktoum Road, Deira, Dubai, UAE" },
  "014": { name: "Blom Bank France (Blom)", swift: "BLOMAEADXXX", address: "Sheikh Zayed Road, Dubai, UAE" },
  "015": { name: "Banque Misr (Banque Misr)", swift: "BCAIAEAAXXX", address: "Al Rigga Road, Deira, Dubai, UAE" },
  "016": { name: "Credit Agricole Corporate and Investment Bank (CACIB)", swift: "BSUIAEADXXX", address: "Sheikh Zayed Road, Dubai, UAE" },
  "017": { name: "Al Khaliji France S.A. (Al Khaliji)", swift: "LICOAEADXXX", address: "Al Khaliji Building, Sheikh Zayed Road, Dubai, UAE" },
  "018": { name: "BNP Paribas (BNP)", swift: "BNPAAEAAXXX", address: "BNP Paribas Tower, Sheikh Zayed Road, Dubai, UAE" },
  "019": { name: "Barclays Bank PLC (Barclays)", swift: "BARCAEADXXX", address: "Al Fattan Currency House, DIFC, Dubai, UAE" },
  "020": { name: "HSBC Bank Middle East (HSBC)", swift: "BBMEAEADXXX", address: "HSBC Tower, Emaar Square, Downtown Dubai, UAE" },
  "021": { name: "Citibank N.A. (Citi)", swift: "CITIAEADXXX", address: "Internet City, Sheikh Zayed Road, Dubai, UAE" },
  "022": { name: "Commercial Bank International (CBI)", swift: "CLBIAEADXXX", address: "CBI Building, Al Maktoum Road, Deira, Dubai, UAE" },
  "023": { name: "Commercial Bank of Dubai (CBD)", swift: "CBDUAEADXXX", address: "CBD Head Office, Al Maktoum Road, Deira, Dubai, UAE" },
  "024": { name: "Dubai Islamic Bank (DIB)", swift: "DUIBAEADXXX", address: "DIB Building, Omar Bin Khattab Road, Dubai, UAE" },
  "025": { name: "El Nilein Bank (El Nilein)", swift: "NILBAEAAXXX", address: "Khalid Bin Al Walid Road, Dubai, UAE" },
  "026": { name: "Emirates NBD (ENBD)", swift: "EBILAEADXXX", address: "Baniyas Road, Deira, Dubai, UAE" },
  "027": { name: "First Gulf Bank / First Abu Dhabi Bank (FAB)", swift: "FGBMAEAAXXX", address: "FAB Building, Sheikh Zayed Road, Abu Dhabi, UAE" },
  "028": { name: "Habib Bank Limited (HBL)", swift: "HABBAEADXXX", address: "Khalid Bin Al Walid Road, Dubai, UAE" },
  "029": { name: "Habib Bank AG Zurich (HBZ)", swift: "HBZUAEADXXX", address: "Al Maktoum Road, Deira, Dubai, UAE" },
  "030": { name: "Investbank PSC (InvestBank)", swift: "IBTFAEASXXX", address: "Investbank Building, Al Buhairah Corniche, Sharjah, UAE" },
  "031": { name: "Janata Bank (Janata)", swift: "JANBAEAAXXX", address: "Abu Dhabi, UAE" },
  "032": { name: "Lloyds TSB Bank PLC (Lloyds)", swift: "LOYDAEADXXX", address: "Sheikh Zayed Road, Dubai, UAE" },
  "033": { name: "Mashreq Bank (Mashreq)", swift: "BOMLAEADXXX", address: "Mashreqbank PSC, Oud Metha Road, Dubai, UAE" },
  "034": { name: "Emirates Islamic Bank (EIB)", swift: "MEBLAEADXXX", address: "Emirates Islamic Building, Al Qusais, Dubai, UAE" },
  "035": { name: "National Bank of Abu Dhabi / First Abu Dhabi Bank (FAB)", swift: "NBADAEAAXXX", address: "FAB Tower, Khalifa Business Park, Abu Dhabi, UAE" },
  "036": { name: "National Bank of Bahrain (NBB)", swift: "NBOBAEAAXXX", address: "Al Maktoum Road, Deira, Dubai, UAE" },
  "038": { name: "National Bank of Fujairah (NBF)", swift: "NBFUAEAFXXX", address: "NBF Head Office, Fujairah, UAE" },
  "039": { name: "National Bank of Oman (NBO)", swift: "NBOMAEADXXX", address: "Al Maktoum Road, Dubai, UAE" },
  "040": { name: "RAKBANK (National Bank of Ras Al-Khaimah)", swift: "NRAKAEAKXXX", address: "RAKBANK Head Office, Al Nakheel Road, Ras Al Khaimah, UAE" },
  "041": { name: "Sharjah Islamic Bank (SIB)", swift: "NBSHAEASXXX", address: "SIB Tower, Al Buhairah Corniche, Sharjah, UAE" },
  "042": { name: "National Bank of Umm Al Qaiwain (NBQ)", swift: "UMMQAEADXXX", address: "NBQ Head Office, Umm Al Qaiwain, UAE" },
  "043": { name: "Industrial and Commercial Bank of China (ICBC)", swift: "ICBKAEAAXXX", address: "ICBC Tower, Sheikh Zayed Road, Dubai, UAE" },
  "044": { name: "Standard Chartered Bank UAE (SCB)", swift: "SCBLAEADXXX", address: "Standard Chartered Tower, Downtown Dubai, UAE" },
  "045": { name: "Union National Bank / First Abu Dhabi Bank (FAB)", swift: "UNBEAEAAXXX", address: "UNB Tower, Khalifa Street, Abu Dhabi, UAE" },
  "046": { name: "United Arab Bank (UAB)", swift: "UARBAEAAXXX", address: "UAB Tower, Corniche Road, Sharjah, UAE" },
  "047": { name: "United Bank Ltd. (UBL)", swift: "UNILAEADXXX", address: "Khalid Bin Al Walid Road, Dubai, UAE" },
  "048": { name: "Emirates Investment Bank (EIBank)", swift: "AEINAEADXXX", address: "Emaar Square, Downtown Dubai, UAE" },
  "049": { name: "Deutsche Bank AG (Deutsche)", swift: "DEUTAEAAXXX", address: "Deutsche Bank Building, Sheikh Zayed Road, Dubai, UAE" },
  "050": { name: "Abu Dhabi Islamic Bank (ADIB)", swift: "ABDIAEADXXX", address: "ADIB Tower, Khalifa Street, Abu Dhabi, UAE" },
  "051": { name: "Dubai Bank (Dubai Bank)", swift: "DBXPAEADXXX", address: "Dubai, UAE" },
  "052": { name: "Noor Bank (Noor)", swift: "NISLAEADXXX", address: "Noor Bank Tower, Sheikh Zayed Road, Dubai, UAE" },
  "053": { name: "Al Hilal Bank (AHB)", swift: "HLALAEAAXXX", address: "Al Hilal Bank Building, Khalifa City A, Abu Dhabi, UAE" },
  "054": { name: "Doha Bank (Doha Bank)", swift: "DOHBAEADXXX", address: "Deira, Dubai, UAE" },
  "055": { name: "SAMBA Financial Group (SAMBA)", swift: "SAMBAEADXXX", address: "Sheikh Zayed Road, Dubai, UAE" },
  "056": { name: "National Bank of Kuwait (NBK)", swift: "NBOKAEADXXX", address: "Sheikh Zayed Road, Dubai, UAE" },
  "057": { name: "Ajman Bank (Ajman Bank)", swift: "AJMNAEAJXXX", address: "Ajman Bank Building, Sheikh Humaid Bin Rashid Al Nuaimi Street, Ajman, UAE" },
  "060": { name: "Wio Bank PJSC (Wio)", swift: "WIOBAEADXXX", address: "Etihad Airways Centre, 5th Floor, Abu Dhabi, UAE" },
  "081": { name: "Finance House (Finance House)", swift: "FHOUAEADXXX", address: "Finance House Tower, Khalifa Street, Abu Dhabi, UAE" },
  "082": { name: "Dunia Finance (Dunia)", swift: "N/A", address: "Dubai, UAE" },
  "083": { name: "Islamic Finance Company (IFC)", swift: "N/A", address: "UAE" },
  "084": { name: "Mawarid Finance (Mawarid)", swift: "N/A", address: "Sheikh Zayed Road, Dubai, UAE" },
  "085": { name: "MAF Finance (MAF)", swift: "N/A", address: "Majid Al Futtaim Tower, Sheikh Zayed Road, Dubai, UAE" },
  "086": { name: "Wio Bank PJSC (Wio)", swift: "WIOBAEADXXX", address: "Etihad Airways Centre, 5th Floor, Abu Dhabi, UAE" },
  "097": { name: "Al Maryah Community Bank LLC", swift: "E097AEXX", address: "Al Maryah Community Bank LLC, Abu Dhabi, UAE" },
  "132": { name: "Ruya Community Islamic Bank", swift: "E132AEXX", address: "Marsa Ajman Mall, Building No.4, Liwara 1, Ajman, UAE" },
  "802": { name: "Emirates Industrial Bank / Emirates Development Bank (EDB)", swift: "EMIUAEAAXXX", address: "Abu Dhabi, UAE" },
};

// ================================================================
// SAUDI ARABIA BANK REGISTRY
// Bank code = digits 5-6 of SA IBAN (2 digits)
// Example: SA03 [80] 000000608010167519 → bank code = 80 (Al Rajhi)
// ================================================================
const SA_BANKS = {
  "01": { name: "Saudi Central Bank (SAMA)", swift: "SAMASARIXXX", address: "SAMA Head Office, Riyadh, Saudi Arabia" },
  "05": { name: "Alinma Bank (Alinma)", swift: "INMASARIXXX", address: "King Fahd Road, Riyadh, Saudi Arabia" },
  "10": { name: "Saudi National Bank / Al Ahli (SNB)", swift: "NCBKSAJEXXX", address: "King Abdulaziz Road, Riyadh, Saudi Arabia" },
  "15": { name: "Bank AlBilad (Albilad)", swift: "ALBISARIXXX", address: "Al Ulaya District, Riyadh, Saudi Arabia" },
  "20": { name: "Riyad Bank (Riyad)", swift: "RIBLSARIXXX", address: "King Abdulaziz Road, Riyadh, Saudi Arabia" },
  "30": { name: "Arab National Bank (ANB)", swift: "ARNBSARIXXX", address: "King Faisal Street, Riyadh, Saudi Arabia" },
  "40": { name: "Samba Financial Group / SNB (Samba)", swift: "SAMBSARIXXX", address: "King Abdulaziz Road, Riyadh, Saudi Arabia" },
  "45": { name: "Saudi Awwal Bank (SAB)", swift: "SABBSARIXXX", address: "Prince Abdulaziz Bin Mousaed Bin Jalawi Street, Riyadh, Saudi Arabia" },
  "50": { name: "Saudi Awwal Bank Legacy Alawwal (SAB)", swift: "SABBSARIXXX", address: "Prince Abdulaziz Bin Mousaed Bin Jalawi Street, Riyadh, Saudi Arabia" },
  "55": { name: "Banque Saudi Fransi (BSF)", swift: "BSFRSARIXXX", address: "Prince Abdulaziz Bin Mousaed Bin Jalawi Street, Riyadh, Saudi Arabia" },
  "60": { name: "Bank AlJazira (BAJ)", swift: "BJAZSAJEXXX", address: "Prince Abdulaziz Bin Mousaed Bin Jalawi Street, Jeddah, Saudi Arabia" },
  "65": { name: "Saudi Investment Bank (SAIB)", swift: "SIBCSARIXXX", address: "Maathar Street, Riyadh, Saudi Arabia" },
  "71": { name: "National Bank of Bahrain Saudi Arabia (NBB)", swift: "NBOBSARIXXX", address: "Riyadh, Saudi Arabia" },
  "75": { name: "National Bank of Kuwait Saudi Arabia (NBK)", swift: "NBOKSAJEXXX", address: "Riyadh, Saudi Arabia" },
  "76": { name: "Bank Muscat Saudi Arabia (Bank Muscat)", swift: "BMUSSARIXXX", address: "Riyadh, Saudi Arabia" },
  "80": { name: "Al Rajhi Bank (Al Rajhi)", swift: "RJHISARIXXX", address: "Olaya Street, Riyadh, Saudi Arabia" },
  "81": { name: "Deutsche Bank Saudi Arabia (Deutsche)", swift: "DEUTSARIXXX", address: "Riyadh, Saudi Arabia" },
  "82": { name: "National Bank of Pakistan Saudi Arabia (NBP)", swift: "NBOPSARIXXX", address: "Riyadh, Saudi Arabia" },
  "83": { name: "State Bank of India Saudi Arabia (SBI)", swift: "SBOISAJEXXX", address: "Riyadh, Saudi Arabia" },
  "84": { name: "Turkiye Cumhuriyeti Ziraat Bankasi (Ziraat)", swift: "TCZTSAJEXXX", address: "Riyadh, Saudi Arabia" },
  "86": { name: "JP Morgan Chase Saudi Arabia (JP Morgan)", swift: "CHASSARIXXX", address: "Riyadh, Saudi Arabia" },
  "87": { name: "Industrial and Commercial Bank of China Saudi Arabia (ICBC)", swift: "ICBKSARIXXX", address: "Riyadh, Saudi Arabia" },
  "90": { name: "Gulf International Bank Saudi Arabia (GIB)", swift: "GULFSARIXXX", address: "Al Khobar, Eastern Province, Saudi Arabia" },
  "95": { name: "Emirates NBD Saudi Arabia (ENBD)", swift: "EBILSARIXXX", address: "Riyadh, Saudi Arabia" },
  "98": { name: "BNP Paribas Saudi Arabia (BNP)", swift: "BNPASARIXXX", address: "Riyadh, Saudi Arabia" },
};
 
// ================================================================
// QATAR BANK REGISTRY
// Bank code = digits 5-8 of QA IBAN (4 letters)
// Example: QA58 [DOHB] 00001234567890ABCDEFG → bank code = DOHB
// ================================================================
const QA_BANKS = {
  "QNBA": { name: "Qatar National Bank (QNB)", swift: "QNBAQAQAXXX", address: "QNB Tower, West Bay, Doha, Qatar" },
  "CBQA": { name: "Commercial Bank of Qatar (CBQ)", swift: "CBQAQAQAXXX", address: "Grand Hamad Street, Doha, Qatar" },
  "DOHB": { name: "Doha Bank (Doha Bank)", swift: "DOHBQAQAXXX", address: "Doha Bank Tower, West Bay, Doha, Qatar" },
  "QISB": { name: "Qatar Islamic Bank (QIB)", swift: "QISBQAQAXXX", address: "Grand Hamad Street, Doha, Qatar" },
  "ABQQ": { name: "Ahli Bank of Qatar (Ahli Bank)", swift: "ABQQQAQAXXX", address: "Grand Hamad Street, Doha, Qatar" },
  "QIIB": { name: "Qatar International Islamic Bank (QIIB)", swift: "QIIBQAQAXXX", address: "Grand Hamad Street, Doha, Qatar" },
  "ARAB": { name: "Arab Bank Qatar (Arab Bank)", swift: "ARABQAQAXXX", address: "Doha, Qatar" },
  "MSHQ": { name: "Mashreq Bank Qatar (Mashreq)", swift: "MSHQQAQAXXX", address: "Doha, Qatar" },
  "IBOQ": { name: "International Bank of Qatar (IBQ)", swift: "IBOQQAQAXXX", address: "West Bay, Doha, Qatar" },
  "BBME": { name: "HSBC Qatar (HSBC)", swift: "BBMEQAQXXXX", address: "HSBC Tower, West Bay, Doha, Qatar" },
  "SCBL": { name: "Standard Chartered Qatar (SCB)", swift: "SCBLQAQXXXX", address: "Doha, Qatar" },
  "UNIL": { name: "United Bank Ltd Qatar (UBL)", swift: "UNILQAQAXXX", address: "Doha, Qatar" },
  "BNPA": { name: "BNP Paribas Qatar (BNP)", swift: "BNPAQAQAXXX", address: "Doha, Qatar" },
  "MAFR": { name: "Rayyan Bank (Rayyan)", swift: "MAFRQAQAXXX", address: "Doha, Qatar" },
  "KLJI": { name: "Al Khalij Commercial Bank (Al Khalij)", swift: "KLJIQAQAXXX", address: "Doha, Qatar" },
  "BRWA": { name: "Barwa Bank (Barwa)", swift: "BRWAQAQAXXX", address: "Doha, Qatar" },
  "QIDB": { name: "Qatar Development Bank (QDB)", swift: "QIDBQAQAXXX", address: "Doha, Qatar" },
};
 
// ================================================================
// KUWAIT BANK REGISTRY
// Bank code = digits 5-8 of KW IBAN (4 letters)
// Example: KW81 [CBKU] 0000000000001234560101 → bank code = CBKU
// ================================================================
const KW_BANKS = {
  "NBOK": { name: "National Bank of Kuwait (NBK)", swift: "NBOKKWKWXXX", address: "Abdullah Al Ahmed Street, Kuwait City, Kuwait" },
  "KFHO": { name: "Kuwait Finance House (KFH)", swift: "KFHOKWKWXXX", address: "Abdullah Al Ahmed Street, Kuwait City, Kuwait" },
  "CBKU": { name: "Central Bank of Kuwait (CBK)", swift: "CBKUKWKWXXX", address: "P.O. Box 526 Safat, Kuwait City, Kuwait" },
  "CBKK": { name: "Commercial Bank of Kuwait (CBK)", swift: "CBKKKWKWXXX", address: "Mubarak Al Kabeer Street, Kuwait City, Kuwait" },
  "GULB": { name: "Gulf Bank Kuwait (Gulf Bank)", swift: "GULBKWKWXXX", address: "Mubarak Al Kabeer Street, Kuwait City, Kuwait" },
  "ABKK": { name: "Ahli Bank of Kuwait (ABK)", swift: "ABKKKWKWXXX", address: "Ahmad Al Jaber Street, Kuwait City, Kuwait" },
  "BOUB": { name: "Boubyan Bank (Boubyan)", swift: "BOUBKWKWXXX", address: "Abdullah Al Ahmed Street, Kuwait City, Kuwait" },
  "BURG": { name: "Burgan Bank (Burgan)", swift: "BURGKWKWXXX", address: "Khalid Ibn Al Waleed Street, Kuwait City, Kuwait" },
  "WARB": { name: "Warba Bank (Warba)", swift: "WARBKWKWXXX", address: "Al Mirqab District, Kuwait City, Kuwait" },
  "KWIB": { name: "Kuwait International Bank (KIB)", swift: "KWIBKWKWXXX", address: "Ahmad Al-Jabber Street, Kuwait City, Kuwait" },
  "BBKK": { name: "Bank of Bahrain and Kuwait Kuwait (BBK)", swift: "BBKKKWKWXXX", address: "Kuwait City, Kuwait" },
};
 
// ================================================================
// BAHRAIN BANK REGISTRY
// Bank code = digits 5-8 of BH IBAN (4 letters = first 4 of SWIFT)
// Example: BH50 [NBOB] 00001299123456 → bank code = NBOB
// ================================================================
const BH_BANKS = {
  "NBOB": { name: "National Bank of Bahrain (NBB)", swift: "NBOBHMBAXXX", address: "Government Avenue, Manama, Bahrain" },
  "BBME": { name: "HSBC Bahrain (HSBC)", swift: "BBMEBHBMXXX", address: "Manama Centre, Manama, Bahrain" },
  "BBKU": { name: "Bank of Bahrain and Kuwait (BBK)", swift: "BBKUBHBMXXX", address: "Diplomatic Area, Manama, Bahrain" },
  "AUBB": { name: "Ahli United Bank (AUB)", swift: "AUBBHBMBXXX", address: "Government Avenue, Manama, Bahrain" },
  "CITI": { name: "Citibank Bahrain (Citi)", swift: "CITIBHBMXXX", address: "Manama, Bahrain" },
  "BNPA": { name: "BNP Paribas Bahrain (BNP)", swift: "BNPABHBMXXX", address: "Manama, Bahrain" },
  "SCBL": { name: "Standard Chartered Bahrain (SCB)", swift: "SCBLBHBMXXX", address: "Manama, Bahrain" },
  "ISLM": { name: "Al Salam Bank (Al Salam)", swift: "ISLMBHBMXXX", address: "Manama, Bahrain" },
  "BIBB": { name: "Bahrain Islamic Bank (BIsB)", swift: "BIBBBHBMXXX", address: "Government Avenue, Manama, Bahrain" },
  "KFHO": { name: "Kuwait Finance House Bahrain (KFH)", swift: "KFHOBHBMXXX", address: "Manama, Bahrain" },
  "GULB": { name: "Gulf International Bank (GIB)", swift: "GULBBHBIXXX", address: "Diplomatic Area, Manama, Bahrain" },
  "RIBL": { name: "Riyad Bank Bahrain (Riyad)", swift: "RIBLBHBMXXX", address: "Manama, Bahrain" },
  "KHCB": { name: "Khaleeji Commercial Bank (KHCB)", swift: "KHCBBHBMXXX", address: "Diplomatic Area, Manama, Bahrain" },
  "ARAB": { name: "Arab Banking Corporation (ABC)", swift: "ARABBHBMXXX", address: "ABC Tower, Diplomatic Area, Manama, Bahrain" },
  "CBBB": { name: "Central Bank of Bahrain (CBB)", swift: "CBBABHBMXXX", address: "Diplomatic Area, Manama, Bahrain" },
  "ITHMB": { name: "Ithmaar Bank (Ithmaar)", swift: "ITBHBHBMXXX", address: "Diplomatic Area, Manama, Bahrain" },
};
 
// ================================================================
// OMAN BANK REGISTRY
// Bank code = digits 5-7 of OM IBAN (3 digits)
// Example: OM81 [014] 0000000049101xxxxxx → bank code = 014
// ================================================================
const OM_BANKS = {
  "002": { name: "Oman Arab Bank (OAB)", swift: "OMABOMRXXXX", address: "Muttrah Business District, Muscat, Oman" },
  "010": { name: "Bank Muscat (Bank Muscat)", swift: "BMUSOMRXXXX", address: "Bank Muscat Head Office, Ruwi, Muscat, Oman" },
  "014": { name: "National Bank of Oman (NBO)", swift: "NBOMOMRXXXX", address: "NBO Head Office, Ruwi, Muscat, Oman" },
  "020": { name: "Oman Arab Bank (OAB)", swift: "OMABOM0MXXX", address: "Muttrah Business District, Muscat, Oman" },
  "025": { name: "Bank Dhofar (Bank Dhofar)", swift: "BKDBOM0MXXX", address: "Bank Dhofar Head Office, Ruwi, Muscat, Oman" },
  "027": { name: "Bank Muscat (Bank Muscat)", swift: "BMUSOMRXXXX", address: "Bank Muscat Head Office, Ruwi, Muscat, Oman" },
  "030": { name: "HSBC Oman (HSBC)", swift: "BBMEOM0MXXX", address: "Muttrah Business District, Muscat, Oman" },
  "031": { name: "Sohar International Bank", swift: "BKSFOMRXXXX", address: "Sohar International Head Office, Muscat, Oman" },
  "035": { name: "Standard Chartered Oman (SCB)", swift: "SCBLOM0MXXX", address: "Muscat, Oman" },
  "040": { name: "Ahli Bank Oman (Ahli Bank)", swift: "AHLIOM0MXXX", address: "CBD Area, Muscat, Oman" },
  "050": { name: "Bank Sohar / Bank Muscat (Bank Sohar)", swift: "BKSFOM0MXXX", address: "Bank Sohar Head Office, Muscat, Oman" },
  "060": { name: "Oman Housing Bank (OHB)", swift: "OHBOOM0MXXX", address: "Muscat, Oman" },
  "070": { name: "Bank Nizwa (Bank Nizwa)", swift: "BNIZOM0MXXX", address: "Muscat, Oman" },
  "080": { name: "Alizz Islamic Bank (Alizz)", swift: "ALIZOM0MXXX", address: "Muscat, Oman" },
  "095": { name: "Citibank Oman (Citi)", swift: "CITIOM0MXXX", address: "Muscat, Oman" },
  "155": { name: "Meethaq Islamic Banking / Bank Muscat (Meethaq)", swift: "BMUSOMRXXXX", address: "Muscat, Oman" },
  "180": { name: "Muzn Islamic Banking / NBO (Muzn)", swift: "NBOMOMRXXXX", address: "Muscat, Oman" },
};

// ================================================================
// JORDAN BANK REGISTRY
// Bank code = digits 5-8 of JO IBAN (4 letters = first 4 of SWIFT)
// Example: JO94 [CBJO] 0010000000000131000302 → bank code = CBJO
// Source: Central Bank of Jordan / SWIFT registry
// ================================================================
const JO_BANKS = {
  "CBJO": { name: "Central Bank of Jordan (CBJ)", swift: "CBJOJOAXXXX", address: "King Hussein Street, Amman 11118, Jordan" },
  "BOJO": { name: "Bank of Jordan PLC (BOJ)", swift: "BOJOJOAXXXX", address: "Shmeisani, Amman, Jordan" },
  "BJOR": { name: "Bank of Jordan PLC (BOJ)", swift: "BJORJOAXXXX", address: "Shmeisani, Amman, Jordan" },
  "JONB": { name: "Jordan Ahli Bank PLC (JAB)", swift: "JONBJOAXXXX", address: "Al Madinah Al Munawarah Street, Amman, Jordan" },
  "JIBA": { name: "Jordan Islamic Bank (JIB)", swift: "JIBAJOAMXXX", address: "Al Thaqafa Street, Shmeisani, Amman, Jordan" },
  "ARAB": { name: "Arab Bank PLC (Arab Bank)", swift: "ARABJOAXXXX", address: "Arab Bank Tower, Abdali, Amman, Jordan" },
  "CAAB": { name: "Cairo Amman Bank (CAB)", swift: "CAABJOAMXXX", address: "Wadi Saqra Street, Amman, Jordan" },
  "AJIB": { name: "Arab Jordan Investment Bank (AJIB)", swift: "AJIBJOAMXXX", address: "Al Kulliyah Al Islamiyah Street, Amman, Jordan" },
  "ABCO": { name: "Arab Banking Corporation Jordan (ABC)", swift: "ABCOJOAMXXX", address: "Abdali, Amman, Jordan" },
  "UBSI": { name: "Union Bank (UB)", swift: "UBSIJOAMXXX", address: "Al Madinah Al Munawarah Street, Amman, Jordan" },
  "INMA": { name: "Invest Bank PLC (InvestBank)", swift: "INMAJOAMXXX", address: "Al Kulliyah Al Islamiyah Street, Amman, Jordan" },
  "SGBJ": { name: "Société Générale de Banque - Jordanie (SGBJ)", swift: "SGBJJOAMXXX", address: "Shmeisani, Amman, Jordan" },
  "BLOM": { name: "BLOM Bank Jordan (BLOM)", swift: "BLOMJOAMXXX", address: "Amman, Jordan" },
  "ETIJ": { name: "Bank al Etihad (Etihad)", swift: "ETIJJOAMXXX", address: "Al Hussein Street, Amman, Jordan" },
  "CITI": { name: "Citibank N.A. Jordan (Citi)", swift: "CITIJOAXXXX", address: "Amman, Jordan" },
  "JORD": { name: "Jordan Commercial Bank (JCB)", swift: "JORDJOAMXXX", address: "Amman, Jordan" },
  "IIAB": { name: "Islamic International Arab Bank (IIAB)", swift: "IIABJOAMXXX", address: "Amman, Jordan" },
  "JDIB": { name: "Jordan Dubai Islamic Bank (JDIB)", swift: "JDIBJOAMXXX", address: "Amman, Jordan" },
  "RJHI": { name: "Al Rajhi Bank Jordan (Al Rajhi)", swift: "RJHIJOAMXXX", address: "Amman, Jordan" },
  "CAPI": { name: "Capital Bank of Jordan (Capital Bank)", swift: "CAPIJOAMXXX", address: "Al Kulliyah Al Islamiyah Street, Amman, Jordan" },
  // Missing / Additional Jordan Banks
  "JKBK": { name: "Jordan Kuwait Bank (JKB)", swift: "JKBKJOAMXXX", address: "Amman, Jordan" },
  "HBTF": { name: "Housing Bank for Trade & Finance (HBTF)", swift: "HBTFJOAMXXX", address: "Amman, Jordan" },
  "ARLB": { name: "Egyptian Arab Land Bank (EALB)", swift: "ARLBJOAMXXX", address: "Amman, Jordan" },
  "SCBL": { name: "Standard Chartered Bank Jordan (SCB)", swift: "SCBLJOAXXXX", address: "Amman, Jordan" },
  "NBOK": { name: "National Bank of Kuwait Jordan (NBK)", swift: "NBOKJOAXXXX", address: "Amman, Jordan" },
  "SAFW": { name: "Safwa Islamic Bank (Safwa)", swift: "SAFWJOAMXXX", address: "Amman, Jordan" },
  "AUDB": { name: "Bank Audi Jordan (Audi)", swift: "AUDBJOAMXXX", address: "Amman, Jordan" },
  "CVDB": { name: "Cities & Villages Development Bank (CVDB)", swift: "CVDBJOA1XXX", address: "Amman, Jordan" },
  "RAFD": { name: "Rafidain Bank Jordan (Rafidain)", swift: "RAFDJOAXXXX", address: "Amman, Jordan" },
};

// ================================================================
// TURKEY BANK REGISTRY
// Bank code = digits 5-9 of TR IBAN (5 digits)
// Example: TR33 [00061] 00000 000000000000 → bank = Ziraat
// ================================================================
const TR_BANKS = {
  "00010": { name: "Ziraat Bank", swift: "TCZBTR2AXXX", address: "Ankara, Turkey" },
  "00100": { name: "Türkiye Cumhuriyeti Merkez Bankası (Central Bank of Turkey)", swift: "TCMBTR2AXXX", address: "Istiklal Cad. No:10, Ulus, Ankara, Turkey" },
  "00012": { name: "Halkbank", swift: "TRHBTR2AXXX", address: "Ankara, Turkey" },
  "00015": { name: "VakifBank", swift: "TVBATR2AXXX", address: "Istanbul, Turkey" },
  "00032": { name: "TEB (BNP Paribas TEB)", swift: "TEBUTRISXXX", address: "Istanbul, Turkey" },
  "00046": { name: "Akbank", swift: "AKBKTRISXXX", address: "Istanbul, Turkey" },
  "00062": { name: "Garanti BBVA", swift: "TGBATRISXXX", address: "Istanbul, Turkey" },
  "00064": { name: "Isbank", swift: "ISBKTRISXXX", address: "Istanbul, Turkey" },
  "00067": { name: "Yapi Kredi", swift: "YAPITRISXXX", address: "Istanbul, Turkey" },
  "00092": { name: "ING Bank Turkey", swift: "INGBTRISXXX", address: "Istanbul, Turkey" },
  "00111": { name: "QNB Finansbank", swift: "FNNBTRISXXX", address: "Istanbul, Turkey" },
  "00134": { name: "DenizBank (Emirates NBD Group)", swift: "DENITRISXXX", address: "Istanbul, Turkey" },
  "00203": { name: "Albaraka Turk Participation Bank", swift: "BTFHTRISXXX", address: "Istanbul, Turkey" },
  "00206": { name: "Kuveyt Turk Participation Bank", swift: "KTEFTRISXXX", address: "Istanbul, Turkey" },
  "00210": { name: "Turkiye Finans Participation Bank", swift: "AFKBTRISXXX", address: "Istanbul, Turkey" },

  // Legacy
  "00075": { name: "Tekstil Bank (now ICBC Turkey)", swift: "TEKBTRISXXX", address: "Istanbul, Turkey", legacy: true },
  "00029": { name: "Birlesik Fon Bankasi", swift: "BTFHTRISXXX", address: "Istanbul, Turkey", legacy: true }
};

// ================================================================
// PAKISTAN BANK REGISTRY
// Bank code = digits 5-8 of PK IBAN (4 letters = first 4 of SWIFT)
// Example: PK36 [SCBL] 0000001123456702 → bank code = SCBL
// Source: State Bank of Pakistan / SWIFT registry
// ================================================================
const PK_BANKS = {
  "SCBL": { name: "Standard Chartered Bank Pakistan (SCB)", swift: "SCBLPKKXXXX", address: "Standard Chartered Tower, I.I. Chundrigar Road, Karachi, Pakistan" },
  "NBPA": { name: "National Bank of Pakistan (NBP)", swift: "NBPAPKKAXXX", address: "NBP Head Office, I.I. Chundrigar Road, Karachi, Pakistan" },
  "HABB": { name: "Habib Bank Limited (HBL)", swift: "HABBPKKAXXX", address: "HBL Plaza, I.I. Chundrigar Road, Karachi, Pakistan" },
  "UNIL": { name: "United Bank Limited (UBL)", swift: "UNILPKKAXXX", address: "UBL Head Office, I.I. Chundrigar Road, Karachi, Pakistan" },
  "MUCB": { name: "MCB Bank Limited (MCB)", swift: "MUCBPKKAXXX", address: "MCB House, F-6/G-6, Islamabad, Pakistan" },
  "MEZN": { name: "Meezan Bank Limited (Meezan)", swift: "MEZNPKKAXXX", address: "Meezan House, C-25 Estate Avenue, SITE, Karachi, Pakistan" },
  "ALFH": { name: "Bank Alfalah Limited (Alfalah)", swift: "ALFHPKKAXXX", address: "B.A. Building, I.I. Chundrigar Road, Karachi, Pakistan" },
  "BAHL": { name: "Bank Al Habib Limited (BAHL)", swift: "BAHLPKKAXXX", address: "Bank Al Habib Tower, 23-Mauve Area, G-10/4, Islamabad, Pakistan" },
  "ABPA": { name: "Allied Bank Limited (ABL)", swift: "ABPAPKKAXXX", address: "Allied Bank House, Abdullah Haroon Road, Karachi, Pakistan" },
  "ASCM": { name: "Askari Bank Limited (Askari)", swift: "ASCMPKKAXXX", address: "AWT Plaza, The Mall, Rawalpindi, Pakistan" },
  "FAYS": { name: "Faysal Bank Limited (Faysal)", swift: "FAYSPKKAXXX", address: "Faysal House, ST-02, Shahrah-e-Faisal, Karachi, Pakistan" },
  "BPUN": { name: "Bank of Punjab (BOP)", swift: "BPUNPKKAXXX", address: "BOP Tower, 10-B, Block E-2, Main Boulevard Gulberg III, Lahore, Pakistan" },
  "JSBL": { name: "JS Bank Limited (JS Bank)", swift: "JSBLPKKAXXX", address: "JS Bank Tower, Plot G-2, KDA Scheme 5, Clifton, Karachi, Pakistan" },
  "SONE": { name: "Soneri Bank Limited (Soneri)", swift: "SONEPKKAXXX", address: "Rupali House, 241-243, Upper Mall, Lahore, Pakistan" },
  "MPBL": { name: "Habib Metropolitan Bank Limited (HMB)", swift: "MPBLPKKAXXX", address: "HMB House, 35-Dockyard Road, West Wharf, Karachi, Pakistan" },
  "BKIP": { name: "BankIslami Pakistan Limited (BankIslami)", swift: "BKIPPKKAXXX", address: "BankIslami Tower, Dolmen City, Block 4, Clifton, Karachi, Pakistan" },
  "DUIB": { name: "Dubai Islamic Bank Pakistan (DIB Pakistan)", swift: "DUIBPKKAXXX", address: "Harbour Front, 9th Floor, Dolmen City, Clifton, Karachi, Pakistan" },
  "MCIB": { name: "MCB Islamic Bank Limited (MCB Islamic)", swift: "MCIBPKKIXXX", address: "MCB Islamic House, 3 Jinnah Avenue, Blue Area, Islamabad, Pakistan" },
  "CITI": { name: "Citibank Pakistan (Citi)", swift: "CITIPKKAXXX", address: "Citibank House, Plot 42 Block 7/8, Shahrah-e-Faisal, Karachi, Pakistan" },
  "SBPP": { name: "State Bank of Pakistan (SBP)", swift: "SBPPPKKAXXX", address: "I.I. Chundrigar Road, Karachi, Pakistan" },
  "KHYB": { name: "Bank of Khyber (BOK)", swift: "KHYBPKKAXXX", address: "24-A, The Mall, Peshawar, Pakistan" },
  "SIND": { name: "Sindh Bank Limited (Sindh Bank)", swift: "SINDPKKAXXX", address: "Sindh Bank House, I.I. Chundrigar Road, Karachi, Pakistan" },
  "AIIN": { name: "Albaraka Bank Pakistan (Albaraka)", swift: "AIINPKKAXXX", address: "Albaraka Islamic Tower, 10th Floor, Main Clifton Road, Karachi, Pakistan" },
  "FWOM": { name: "First Women Bank Limited (FWBL)", swift: "FWOMPKKAXXX", address: "Ground Floor, SBP Building, Shahrah-e-Quaid-e-Azam, Lahore, Pakistan" },
};

// ================================================================
// EGYPT BANK REGISTRY
// Bank code = digits 5-8 of EG IBAN (4 digits numeric)
// Branch code = digits 9-12 of EG IBAN (4 digits numeric)
// Example: EG38 [0019] [0005] 00000000263180002 → bank = 0019 (NBE)
// Source: Central Bank of Egypt / SWIFT registry
// ================================================================
const EG_BANKS = {
  "0019": { name: "National Bank of Egypt (NBE)", swift: "NBEGEGCXXXX", address: "Al Nil Street, Corniche El Nil, Cairo, Egypt" },
  "0022": { name: "Commercial International Bank Egypt (CIB)", swift: "CIBEEGCXXXX", address: "Nile Tower, 21-23 Charles de Gaulle Street, Giza, Egypt" },
  "0025": { name: "Banque Misr (BM)", swift: "BMISEGCXXXX", address: "151 Mohamed Farid Street, Cairo, Egypt" },
  "0027": { name: "Bank of Alexandria (AlexBank)", swift: "ALEXEGCXXXX", address: "49 Kasr El Nil Street, Cairo, Egypt" },
  "0031": { name: "Banque du Caire (BdC)", swift: "BCAIEGCXXXX", address: "22 Adly Street, Cairo, Egypt" },
  "0046": { name: "HSBC Bank Egypt (HSBC)", swift: "EBBKEGCXXXX", address: "306 Corniche El Nil, Cairo, Egypt" },
  "0057": { name: "Arab African International Bank (AAIB)", swift: "ARAIEGCXXXX", address: "5 Midan Al Saraya Al Kobra, Garden City, Cairo, Egypt" },
  "0062": { name: "Credit Agricole Egypt (CAE)", swift: "AGRIEGCXXXX", address: "Garden City Branch, 3 El Pharaana Street, Garden City, Cairo, Egypt" },
  "0067": { name: "Export Development Bank of Egypt (EBank)", swift: "EXPLEGCXXXX", address: "108 Mohamed Farid Street, Cairo, Egypt" },
  "0076": { name: "Arab Bank Egypt (Arab Bank)", swift: "ARABEGCXXXX", address: "26 A, Hassan Sabri Street, Zamalek, Cairo, Egypt" },
  "0085": { name: "Abu Dhabi Islamic Bank Egypt (ADIB Egypt)", swift: "ABDIEGCXXXX", address: "CI Tower, 1st Floor, Mohamed Farid Street, Cairo, Egypt" },
  "0086": { name: "Qatar National Bank Egypt (QNB Egypt)", swift: "QNBAEGCXXXX", address: "17 Kasr El Nil Street, Downtown, Cairo, Egypt" },
  "0091": { name: "First Abu Dhabi Bank Egypt (FAB Egypt)", swift: "NBADEGCXXXX", address: "First Abu Dhabi Bank Egypt, 124 Othman Ibn Affan Street, Heliopolis, Cairo, Egypt" },
  "0092": { name: "Al Ahli Bank of Kuwait Egypt (ABK Egypt)", swift: "ABKKEGCXXXX", address: "Al Ahli Bank of Kuwait Egypt, 66 Mossadak Street, Dokki, Giza, Egypt" },
  "0095": { name: "National Bank of Kuwait Egypt (NBK Egypt)", swift: "NBOKEGCXXXX", address: "National Bank of Kuwait Egypt, 1187 Corniche El Nil Street, Boulak, Cairo, Egypt" },
};

// ================================================================
// UK BANK REGISTRY
// Bank code = characters 5-8 of GB IBAN (4 letters)
// Example: GB29 [NWBK] 601613 31926819 → bank code = NWBK (NatWest)
// ================================================================
const UK_BANKS = {
  "NWBK": { name: "National Westminster Bank (NatWest)", swift: "NWBKGB2LXXX", address: "250 Bishopsgate, London EC2M 4AA, UK" },
  "BARC": { name: "Barclays Bank PLC", swift: "BARCGB22XXX", address: "1 Churchill Place, Canary Wharf, London E14 5HP, UK" },
  "BUKB": { name: "Barclays Bank UK PLC (Retail)", swift: "BUKBGB22XXX", address: "1 Churchill Place, Canary Wharf, London E14 5HP, UK" },
  "LOYD": { name: "Lloyds Bank", swift: "LOYDGB2LXXX", address: "25 Gresham Street, London EC2V 7HN, UK" },
  "HBUK": { name: "HSBC UK Bank", swift: "HBUKGB4BXXX", address: "1 Centenary Square, Birmingham B1 1HQ, UK" },
  "RBOS": { name: "Royal Bank of Scotland (RBS)", swift: "RBOSGB2LXXX", address: "36 St Andrew Square, Edinburgh EH2 2YB, UK" },
  "TSBS": { name: "TSB Bank", swift: "TSBSGB2AXXX", address: "One Lovell Park, Leeds LS1 1NS, UK" },
  "HLFX": { name: "Halifax", swift: "HLFXGB21XXX", address: "Trinity Road, Halifax HX1 2RG, UK" },
  "ABBY": { name: "Santander UK", swift: "ABBYGB2LXXX", address: "2 Triton Square, Regent's Place, London NW1 3AN, UK" },
  "BOFS": { name: "Bank of Scotland", swift: "BOFSGB2SXXX", address: "The Mound, Edinburgh EH1 1YZ, UK" },
  "NAIA": { name: "Nationwide Building Society", swift: "NAIAGB2LXXX", address: "Nationwide House, Pipers Way, Swindon SN38 1NW, UK" },
  "MONZ": { name: "Monzo Bank", swift: "MONZGB2LXXX", address: "Broadwalk House, 5 Appold Street, London EC2A 2AG, UK" },
  "SRLG": { name: "Starling Bank", swift: "SRLGGB2LXXX", address: "Floor 5, 1 Duval Square, London E1 6PW, UK" },
  "REVO": { name: "Revolut", swift: "REVOGB2LXXX", address: "7 Westferry Circus, Canary Wharf, London E14 4HD, UK" },
  "TRWI": { name: "Wise (formerly TransferWise)", swift: "TRWIGB2LXXX", address: "56 Shoreditch High Street, London E1 6JJ, UK" },
  "MYMB": { name: "Metro Bank PLC", swift: "MYMBGB2LXXX", address: "One Southampton Row, London WC1A 5HA, UK" },
  "SBIC": { name: "SBI (UK) Limited (State Bank of India UK)", swift: "SBICGB2LXXX", address: "13-14 Cavendish Place, London W1G 9DD, UK" },
  "CLRB": { name: "ClearBank Limited", swift: "CLRBGB22XXX", address: "Borough Yards, 13 Dirty Lane, London SE1 9PA, UK" },
  "TCCL": { name: "The Currency Cloud Limited", swift: "TCCLGB3LXXX", address: "The Steward Building, 12 Steward Street, London E1 6FQ, UK" },
};

// ================================================================
// BULGARIA BANK REGISTRY
// Bank code = digits 5-8 of BG IBAN (4 letters = first 4 of SWIFT)
// Example: BG80 [BNBG] 9661 1020 345678 → bank code = BNBG
// ================================================================
const BG_BANKS = {
  "BPBI": { name: "Eurobank Bulgaria AD (Postbank)", swift: "BPBIBGSFXXX", address: "Okolovrasten Pat Str. 260, Sofia 1766, Bulgaria" },
  "BNBG": { name: "Bulgarian National Bank (BNB)", swift: "BNBGBGSFXXX", address: "1 Knyaz Alexander I Square, Sofia 1000, Bulgaria" },
  "BUIB": { name: "UniCredit Bulbank", swift: "BUIBBGSFXXX", address: "7 Sveta Nedelya Square, Sofia 1000, Bulgaria" },
  "CECB": { name: "Central Cooperative Bank (CCB)", swift: "CECBBGSFXXX", address: "109 G.S. Rakovski Street, Sofia 1000, Bulgaria" },
  "CREX": { name: "Credit Europe Bank Bulgaria", swift: "CREXBGSFXXX", address: "Sofia, Bulgaria" },
  "DSKI": { name: "DSK Bank", swift: "DSKIBGSFXXX", address: "19 Moskovska Street, Sofia 1036, Bulgaria" },
  "FINV": { name: "First Investment Bank (Fibank)", swift: "FINVBGSFXXX", address: "37 Dragan Tsankov Blvd, Sofia 1797, Bulgaria" },
  "IABG": { name: "International Asset Bank", swift: "IABGBGSFXXX", address: "79B James Bourchier Blvd, Sofia 1407, Bulgaria" },
  "IBAN": { name: "Investbank", swift: "IBANBGSFXXX", address: "10 Todor Alexandrov Blvd, Sofia 1303, Bulgaria" },
  "MBUL": { name: "Municipal Bank", swift: "MBULBGSFXXX", address: "2 Vrabcha Street, Sofia 1000, Bulgaria" },
  "PIRB": { name: "Piraeus Bank Bulgaria", swift: "PIRBBGSFXXX", address: "Sofia, Bulgaria" },
  "RZBR": { name: "Raiffeisenbank Bulgaria", swift: "RZBRBBSFXXX", address: "55 Nikola I. Vaptsarov Blvd, Sofia 1407, Bulgaria" },
  "RZBB": { name: "Raiffeisenbank Bulgaria", swift: "RZBBBBSFXXX", address: "55 Nikola I. Vaptsarov Blvd, Sofia 1407, Bulgaria" },
  "STSA": { name: "Societe Generale Expressbank", swift: "STSABGSFXXX", address: "92 Vladislav Varnenchik Blvd, Varna 9000, Bulgaria" },
  "TTBB": { name: "TBI Bank", swift: "TTBBBGSFXXX", address: "Sofia, Bulgaria" },
  "UBBS": { name: "United Bulgarian Bank (UBB)", swift: "UBBSBGSFXXX", address: "89B Vitosha Blvd, Sofia 1000, Bulgaria" },
};

// ================================================================
// BELGIUM BANK REGISTRY
// Bank code = digits 5-7 of BE IBAN (3 digits numeric)
// Example: BE68 [539] 007547034 → bank code = 539 (ING)
// Note: Belgium has 800+ bank codes. Only codes present in LMC
// payment data are listed here; others fall through to AnyAPI.
// ================================================================
const BE_BANKS = {
  "000": { name: "bpost bank NV/SA", swift: "BPOTBEB1XXX", address: "Rue du Marquis 1, Brussels 1000, Belgium" },
  "001": { name: "BNP Paribas Fortis SA/NV (BNP Paribas Fortis)", swift: "GEBABEBBXXX", address: "Montagne du Parc 3, Brussels 1000, Belgium" },
  "063": { name: "Belfius Bank SA/NV (Belfius)", swift: "GKCCBEBBXXX", address: "Place Charles Rogier 11, Brussels 1210, Belgium" },
  "068": { name: "Belfius Bank SA/NV", swift: "GKCCBEBBXXX", address: "Place Charles Rogier 11, Brussels 1210, Belgium" },
  "075": { name: "Bank Van Breda NV", swift: "BBRUBEBBXXX", address: "Ledeganckkaai 7, Antwerp 2000, Belgium" },
  "096": { name: "Belfius Bank SA/NV", swift: "GKCCBEBBXXX", address: "Place Charles Rogier 11, Brussels 1210, Belgium" },
  "097": { name: "Belfius Bank SA/NV", swift: "GKCCBEBBXXX", address: "Place Charles Rogier 11, Brussels 1210, Belgium" },
  "103": { name: "Crelan SA/NV", swift: "NICABEBBXXX", address: "Sylvain Dupuislaan 251, Brussels 1070, Belgium" },
  "132": { name: "Delen Private Bank NV", swift: "DELBEBBXXX", address: "Jan Van Rijswijcklaan 184, Antwerp 2020, Belgium" },
  "217": { name: "Puilaetco Dewaay Private Bankers SA", swift: "PUIDBEBBXXX", address: "Avenue Herrmann-Debroux 46, Brussels 1160, Belgium" },
  "230": { name: "ING Belgium NV/SA", swift: "BBRUBEBBXXX", address: "Avenue Marnix 24, Brussels 1000, Belgium" },
  "299": { name: "bpost bank NV/SA", swift: "BPOTBEB1XXX", address: "Rue du Marquis 1, Brussels 1000, Belgium" },
  "310": { name: "BNP Paribas Fortis SA/NV", swift: "GEBABEBBXXX", address: "Montagne du Parc 3, Brussels 1000, Belgium" },
  "340": { name: "Triodos Bank Belgium", swift: "TRIOBEBBXXX", address: "Rue Haute 139, Brussels 1000, Belgium" },
  "363": { name: "Beobank NV/SA", swift: "CTBKBEBBXXX", address: "Boulevard du Roi Albert II 7B, Brussels 1210, Belgium" },
  "523": { name: "Argenta Spaarbank NV", swift: "ARSPBE22XXX", address: "Belgiëlei 49-53, Antwerp 2018, Belgium" },
  "539": { name: "ING Belgium NV/SA", swift: "BBRUBEBBXXX", address: "Avenue Marnix 24, Brussels 1000, Belgium" },
  "547": { name: "Hello Bank SA/NV (Hello Bank) → subsidiary of BNP Paribas Fortis", swift: "GEBABEBBXXX", address: "Montagne du Parc 3, Brussels 1000, Belgium" },
  "651": { name: "Keytrade Bank NV (Keytrade)", swift: "KEYTBEBBXXX", address: "Boulevard du Souverain 100, Brussels 1170, Belgium" },
  "732": { name: "CBC Banque SA (CBC) → subsidiary of KBC Bank NV", swift: "KREDBEBBXXX", address: "Avenue Albert II 2, Brussels 1000, Belgium" },
  "734": { name: "KBC Bank NV", swift: "KREDBEBBXXX", address: "Havenlaan 2, Brussels 1080, Belgium" },
  "877": { name: "Byblos Bank Europe SA", swift: "BYBABEBBXXX", address: "Rue des Colonies 11, Brussels 1000, Belgium" },
  "903": { name: "Wise Europe SA (via Paynovate)", swift: "TRWIBEBBXXX", address: "Rue du Trône 100, Floor 3, Brussels 1050, Belgium" },
  "905": { name: "Belfius Bank SA/NV", swift: "GKCCBEBBXXX", address: "Place Charles Rogier 11, Brussels 1210, Belgium" },
  "967": { name: "Wise Europe SA", swift: "TRWIBEBBXXX", address: "Rue du Trône 100, Floor 3, Brussels 1050, Belgium" },
  "979": { name: "Bank of New York Mellon SA/NV", swift: "IRVTBEBBXXX", address: "Avenue des Arts 46, Brussels 1000, Belgium" }
};

// ================================================================
// LITHUANIA BANK REGISTRY
// Bank code = digits 5-9 of LT IBAN (5 digits numeric)
// Example: LT12 [10000] 11101001000 → bank code = 10000 (Bank of Lithuania)
// Source: Bank of Lithuania official IBAN participant list
// ================================================================
const LT_BANKS = {
  "10000": { name: "Bank of Lithuania (Lietuvos Bankas)", swift: "LIABLT2XXXX", address: "Totorių g. 4, LT-01121 Vilnius, Lithuania" },
  "21400": { name: "Luminor Bank AS (Lithuanian branch)", swift: "NDEALT2XXXX", address: "Konstitucijos pr. 21A, LT-03601 Vilnius, Lithuania" },
  "21200": { name: "Luminor Bank AS (ex-Nordea)", swift: "NDEALT2XXXX", address: "Konstitucijos pr. 21A, LT-03601 Vilnius, Lithuania" },
  "40100": { name: "Luminor Bank AS (ex-DNB)", swift: "AGBLLT2XXXX", address: "Konstitucijos pr. 21A, LT-03601 Vilnius, Lithuania" },
  "32500": { name: "Revolut Bank UAB", swift: "REVOLT21XXX", address: "Konstitucijos pr. 21B, LT-08130 Vilnius, Lithuania" },
  "70440": { name: "SEB Bankas AB", swift: "CBVILT2XXXX", address: "Gedimino pr. 12, LT-01103 Vilnius, Lithuania" },
  "72900": { name: "Citadele Bankas (Lithuanian branch)", swift: "INDULT2XXXX", address: "Konstitucijos pr. 20A, LT-03502 Vilnius, Lithuania" },
  "73000": { name: "Swedbank AB (Lithuanian branch)", swift: "HABALT22XXX", address: "Konstitucijos pr. 20A, LT-09308 Vilnius, Lithuania" },
  "74000": { name: "Luminor Bank (ex-Nordea Lithuania)", swift: "NDEALT2XXXX", address: "Konstitucijos pr. 21A, LT-03601 Vilnius, Lithuania" },
  "70500": { name: "Šiaulių Bankas AB", swift: "CBSBLT26XXX", address: "Tilžės g. 149, LT-76348 Šiauliai, Lithuania" },
  "71800": { name: "Šiaulių Bankas AB", swift: "CBSBLT26XXX", address: "Tilžės g. 149, LT-76348 Šiauliai, Lithuania" },
  "31900": { name: "Paysera LT UAB", swift: "EVIULT21XXX", address: "Mėsinių g. 5, LT-01133 Vilnius, Lithuania" },
};

// ================================================================
// SPAIN BANK REGISTRY
// Bank code = digits 5-8 of ES IBAN (4 digits numeric)
// Example: ES91 [2100] 0418 450200051332 → bank code = 2100 (CaixaBank)
// Source: Banco de España national bank code register
// ================================================================
const ES_BANKS = {
  "0019": { name: "Deutsche Bank SAE (Spain)", swift: "DEUTESMMXXX", address: "Paseo de la Castellana 18, Madrid 28046, Spain" },
  "0049": { name: "Banco Santander SA", swift: "BSABESBBXXX", address: "Ciudad Grupo Santander, Boadilla del Monte, Madrid 28660, Spain" },
  "0073": { name: "Openbank SA (Santander Group)", swift: "OPENESMMXXX", address: "Príncipe de Vergara 187, Madrid 28002, Spain" },
  "0075": { name: "Banco Popular Español SA (merged into Santander)", swift: "POPUESMMXXX", address: "Calle Velázquez 34, Madrid 28001, Spain" },
  "0081": { name: "Banco de Sabadell SA", swift: "BSABESBBXXX", address: "Avenida Óscar Esplá 37, Alicante 03007, Spain" },
  "0128": { name: "Bankinter SA", swift: "BKBKESMMXXX", address: "Paseo de la Castellana 29, Madrid 28046, Spain" },
  "0182": { name: "Banco Bilbao Vizcaya Argentaria SA (BBVA)", swift: "BBVAESMMXXX", address: "Calle Azul 4, Madrid 28050, Spain" },
  "0238": { name: "Banco Societe Generale Spain", swift: "SOGEESMMXXX", address: "Madrid, Spain" },
  "1000": { name: "Banco de España (Central Bank)", swift: "ESPBESMMXXX", address: "Calle Alcalá 48, Madrid 28014, Spain" },
  "1465": { name: "ING España (ING Direct)", swift: "INGDESMMXXX", address: "Paseo de la Castellana 189, Madrid 28046, Spain" },
  "2038": { name: "Bankia SA (merged into CaixaBank)", swift: "CAHMESMMXXX", address: "Calle Pintor Sorolla 8, Valencia 46002, Spain" },
  "2080": { name: "ABANCA Corporación Bancaria SA", swift: "ABCAESMMXXX", address: "Calle Juan Flórez 44, A Coruña 15005, Spain" },
  "2085": { name: "Ibercaja Banco SA", swift: "CAZRES2ZXXX", address: "Plaza de Basilio Paraíso 2, Zaragoza 50008, Spain" },
  "2095": { name: "Kutxabank SA", swift: "BASKES2BXXX", address: "Gran Vía 30-32, Bilbao 48009, Spain" },
  "2100": { name: "CaixaBank SA", swift: "CAIXESBBXXX", address: "Avenida Diagonal 621-629, Barcelona 08028, Spain" },
  "2103": { name: "Unicaja Banco SA", swift: "UCJAES2MXXX", address: "Avenida de Andalucía 10-12, Málaga 29007, Spain" },
  "3016": { name: "Caja Rural del Sur (Grupo Caja Rural)", swift: "BCOEESMMXXX", address: "Tomás de Ibarra 5, Seville 41001, Spain" },
  "3058": { name: "Cajamar Caja Rural SCC", swift: "CCRIES2AXXX", address: "Carretera de Málaga s/n, Almería 04120, Spain" },
};

// ================================================================
// MALTA BANK REGISTRY
// Bank code = characters 5-8 of MT IBAN (4 letters)
// Example: MT84 [VALL] 0110 0001 2345 MTLC AST0 01S → bank = VALL (Bank of Valletta)
// Source: Malta Financial Services Authority / SWIFT Registry
// ================================================================
const MT_BANKS = {
  "VALL": { name: "Bank of Valletta (BOV)", swift: "VALLMTMTXXX", address: "58 Zachary Street, Valletta, Malta" },
  "MALT": { name: "Bank of Valletta (BOV)", swift: "VALLMTMTXXX", address: "58 Zachary Street, Valletta, Malta" },
  "BOVM": { name: "Bank of Valletta (BOV) → formerly National Bank of Malta", swift: "VALLMTMTXXX", address: "58 Zachary Street, Valletta, Malta" },
  "MMEB": { name: "HSBC Bank Malta (HSBC)", swift: "MMEBMTMTXXX", address: "116 Archbishop Street, Valletta, Malta" },
  "APSB": { name: "APS Bank (APS)", swift: "APSBMTMTXXX", address: "APS Centre, Tower Street, Birkirkara, Malta" },
  "MBRM": { name: "MeDirect Bank (MeDirect) → formerly Mediterranean Bank", swift: "MBRMMTMTXXX", address: "The Centre, Tigne Point, Sliema, Malta" },
  "BMAL": { name: "Banif Bank Malta (Banif)", swift: "BNIFMTMTXXX", address: "Triq il-Kbira, Sliema, Malta" },
  "BNFN": { name: "BNF Bank (BNF) → formerly Banif Bank", swift: "BNFNMTMTXXX", address: "203 Level 3, Rue D’Argens, Gzira, Malta" },
  "FIMB": { name: "FIMBank (FIMBank)", swift: "FIMBMTMXXXX", address: "Mercury Tower, St Julian’s, Malta" },
  "IZOL": { name: "Izola Bank (Izola)", swift: "IZOLMTMXXXX", address: "53 Abate Rigord Street, Ta' Xbiex, Malta" },
  "SPBK": { name: "Sparkasse Bank Malta (Sparkasse)", swift: "SBMMMTMXXXX", address: "101 Townsquare, Sliema, Malta" },
};

// ================================================================
// CYPRUS BANK REGISTRY
// Bank code = digits 5-7 of CY IBAN (3 digits)
// Example: CY17 [002] 001 28 0000000120052760 → bank = 002 (Bank of Cyprus)
// Source: Central Bank of Cyprus / SWIFT Registry
// ================================================================
const CY_BANKS = {
  "001": { name: "Central Bank of Cyprus (CBC)", swift: "CBCYCY2NXXX", address: "80 Kennedy Avenue, Nicosia, Cyprus" },
  "002": { name: "Bank of Cyprus (BOC) → merged Laiki Bank / Cyprus Popular Bank", swift: "BCYPCY2NXXX", address: "51 Stassinos Street, Nicosia, Cyprus" },
  "003": { name: "Hellenic Bank (HB) → acquired assets of RCB Bank", swift: "HEBACY2NXXX", address: "200 Limassol Avenue, Strovolos, Nicosia, Cyprus" },
  "004": { name: "Eurobank Cyprus (Eurobank)", swift: "ERBKCY2NXXX", address: "41 Arch. Makarios III Avenue, Nicosia, Cyprus" },
  "005": { name: "Alpha Bank Cyprus (Alpha)", swift: "CRBACY2NXXX", address: "3 Byron Avenue, Nicosia, Cyprus" },
  "006": { name: "National Bank of Greece Cyprus (NBG)", swift: "ETHNCY2NXXX", address: "46 Makarios Avenue, Nicosia, Cyprus" },
  "007": { name: "AstroBank (AstroBank) → formerly Piraeus Bank Cyprus", swift: "PIRBCY2NXXX", address: "1 Spyrou Kyprianou Avenue, Nicosia, Cyprus" },
  "008": { name: "Societe Generale Cyprus (SG)", swift: "SOGECY2NXXX", address: "Limassol, Cyprus" },
  "009": { name: "RCB Bank (RCB) → formerly Russian Commercial Bank → operations transferred to Hellenic Bank", swift: "RCBKCY2NXXX", address: "97 Makarios Avenue, Nicosia, Cyprus" },
  "010": { name: "Eurobank EFG Cyprus (Eurobank EFG)", swift: "EFGBCY2NXXX", address: "Limassol, Cyprus" },
  "011": { name: "Ancoria Bank (Ancoria)", swift: "ANCYCY2NXXX", address: "13 Amathountos Avenue, Limassol, Cyprus" },
  "012": { name: "Housing Finance Corporation (HFC)", swift: "HFCFCY2NXXX", address: "26 Makarios Avenue, Nicosia, Cyprus" },
  "013": { name: "Cyprus Development Bank (CDB)", swift: "CDBLCY2NXXX", address: "50 Arch. Makarios III Avenue, Nicosia, Cyprus" },
};

// ================================================================
// NETHERLANDS BANK REGISTRY
// Bank code = characters 5-8 of NL IBAN (4 letters)
// Example: NL91 [ABNA] 0417 1643 00 → bank = ABNA (ABN AMRO)
// Source: Dutch Central Bank (DNB) / SWIFT Registry
// ================================================================
const NL_BANKS = {
  "ABNA": { name: "ABN AMRO Bank (ABN AMRO) → merged with Fortis Bank Nederland", swift: "ABNANL2AXXX", address: "Gustav Mahlerlaan 10, 1082 PP Amsterdam, Netherlands" },
  "INGB": { name: "ING Bank (ING) → merger Internationale Nederlanden Group + NMB Postbank", swift: "INGBNL2AXXX", address: "Bijlmerdreef 106, 1102 CT Amsterdam, Netherlands" },
  "RABO": { name: "Rabobank (Rabobank) → merger Raiffeisen Bank + Boerenleenbank", swift: "RABONL2UXXX", address: "Croeselaan 18, 3521 CB Utrecht, Netherlands" },
  "SNSB": { name: "SNS Bank (SNS) → part of Volksbank", swift: "SNSBNL2AXXX", address: "Croeselaan 1, 3521 BJ Utrecht, Netherlands" },
  "ASNB": { name: "ASN Bank (ASN) → part of Volksbank", swift: "ASNBNL21XXX", address: "Croeselaan 1, 3521 BJ Utrecht, Netherlands" },
  "RBRB": { name: "RegioBank (RegioBank) → part of Volksbank", swift: "RBRBNL21XXX", address: "Croeselaan 1, 3521 BJ Utrecht, Netherlands" },
  "TRIO": { name: "Triodos Bank (Triodos)", swift: "TRIONL2UXXX", address: "Hoofdstraat 10, 3972 LA Driebergen-Rijsenburg, Netherlands" },
  "BUNQ": { name: "bunq Bank (bunq)", swift: "BUNQNL2AXXX", address: "Naritaweg 131-133, 1043 BS Amsterdam, Netherlands" },
  "KNAB": { name: "Knab Bank (Knab) → formerly Aegon Bank", swift: "KNABNL2HXXX", address: "Hoogoorddreef 15, 1101 BA Amsterdam, Netherlands" },
  "NWAB": { name: "Nederlandse Waterschapsbank (NWB)", swift: "NWABNL2GXXX", address: "Haagweg 1, 2311 AA Leiden, Netherlands" },
  "FVLB": { name: "Van Lanschot Kempen (Van Lanschot)", swift: "FVLB NL22XXX", address: "Hooge Steenweg 29, 5211 JN 's-Hertogenbosch, Netherlands" },
  "HAND": { name: "Handelsbanken Netherlands (Handelsbanken)", swift: "HANDNL2AXXX", address: "Herengracht 450, 1017 CA Amsterdam, Netherlands" },
  "HHBA": { name: "Hof Hoorneman Bankiers (HHB)", swift: "HHBANL2AXXX", address: "Gustav Mahlerplein 70, Amsterdam, Netherlands" },
  "KASA": { name: "KAS Bank → merged with CACEIS Bank", swift: "KASANL2AXXX", address: "Nieuwezijds Voorburgwal 225, Amsterdam, Netherlands" },
  "CACE": { name: "CACEIS Bank (CACEIS)", swift: "CACE NL2AXXX", address: "De Entree 500, Amsterdam, Netherlands" },
  "BKCH": { name: "Bank of China Netherlands (BOC)", swift: "BKCHNL2AXXX", address: "WTC Tower, Amsterdam, Netherlands" },
  "ICBC": { name: "ICBC Netherlands (ICBC)", swift: "ICBKNL2AXXX", address: "Amsterdam, Netherlands" },
};

// ================================================================
// COUNTRY IBAN REGISTRY
// Contains all supported countries with IBAN lengths and currencies
// ================================================================
const COUNTRY_IBAN = {
  AE:{len:23,country:"United Arab Emirates",flag:"🇦🇪",currency:"AED"},
  AL:{len:28,country:"Albania",flag:"🇦🇱",currency:"ALL"},
  AD:{len:24,country:"Andorra",flag:"🇦🇩",currency:"EUR"},
  AT:{len:20,country:"Austria",flag:"🇦🇹",currency:"EUR"},
  AZ:{len:28,country:"Azerbaijan",flag:"🇦🇿",currency:"AZN"},
  BH:{len:22,country:"Bahrain",flag:"🇧🇭",currency:"BHD"},
  BE:{len:16,country:"Belgium",flag:"🇧🇪",currency:"EUR"},
  BA:{len:20,country:"Bosnia and Herzegovina",flag:"🇧🇦",currency:"BAM"},
  BR:{len:29,country:"Brazil",flag:"🇧🇷",currency:"BRL"},
  BG:{len:22,country:"Bulgaria",flag:"🇧🇬",currency:"BGN"},
  CR:{len:22,country:"Costa Rica",flag:"🇨🇷",currency:"CRC"},
  HR:{len:21,country:"Croatia",flag:"🇭🇷",currency:"EUR"},
  CY:{len:28,country:"Cyprus",flag:"🇨🇾",currency:"EUR"},
  CZ:{len:24,country:"Czech Republic",flag:"🇨🇿",currency:"CZK"},
  DK:{len:18,country:"Denmark",flag:"🇩🇰",currency:"DKK"},
  DO:{len:28,country:"Dominican Republic",flag:"🇩🇴",currency:"DOP"},
  EG:{len:29,country:"Egypt",flag:"🇪🇬",currency:"EGP"},
  SV:{len:28,country:"El Salvador",flag:"🇸🇻",currency:"USD"},
  EE:{len:20,country:"Estonia",flag:"🇪🇪",currency:"EUR"},
  FO:{len:18,country:"Faroe Islands",flag:"🇫🇴",currency:"DKK"},
  FI:{len:18,country:"Finland",flag:"🇫🇮",currency:"EUR"},
  FR:{len:27,country:"France",flag:"🇫🇷",currency:"EUR"},
  GE:{len:22,country:"Georgia",flag:"🇬🇪",currency:"GEL"},
  DE:{len:22,country:"Germany",flag:"🇩🇪",currency:"EUR"},
  GI:{len:23,country:"Gibraltar",flag:"🇬🇮",currency:"GIP"},
  GR:{len:27,country:"Greece",flag:"🇬🇷",currency:"EUR"},
  GL:{len:18,country:"Greenland",flag:"🇬🇱",currency:"DKK"},
  GT:{len:28,country:"Guatemala",flag:"🇬🇹",currency:"GTQ"},
  HU:{len:28,country:"Hungary",flag:"🇭🇺",currency:"HUF"},
  IS:{len:26,country:"Iceland",flag:"🇮🇸",currency:"ISK"},
  IQ:{len:23,country:"Iraq",flag:"🇮🇶",currency:"IQD"},
  IE:{len:22,country:"Ireland",flag:"🇮🇪",currency:"EUR"},
  IL:{len:23,country:"Israel",flag:"🇮🇱",currency:"ILS"},
  IT:{len:27,country:"Italy",flag:"🇮🇹",currency:"EUR"},
  JO:{len:30,country:"Jordan",flag:"🇯🇴",currency:"JOD"},
  KZ:{len:20,country:"Kazakhstan",flag:"🇰🇿",currency:"KZT"},
  XK:{len:20,country:"Kosovo",flag:"🇽🇰",currency:"EUR"},
  KW:{len:30,country:"Kuwait",flag:"🇰🇼",currency:"KWD"},
  LV:{len:21,country:"Latvia",flag:"🇱🇻",currency:"EUR"},
  LB:{len:28,country:"Lebanon",flag:"🇱🇧",currency:"LBP"},
  LI:{len:21,country:"Liechtenstein",flag:"🇱🇮",currency:"CHF"},
  LT:{len:20,country:"Lithuania",flag:"🇱🇹",currency:"EUR"},
  LU:{len:20,country:"Luxembourg",flag:"🇱🇺",currency:"EUR"},
  MT:{len:31,country:"Malta",flag:"🇲🇹",currency:"EUR"},
  MR:{len:27,country:"Mauritania",flag:"🇲🇷",currency:"MRU"},
  MU:{len:30,country:"Mauritius",flag:"🇲🇺",currency:"MUR"},
  MC:{len:27,country:"Monaco",flag:"🇲🇨",currency:"EUR"},
  MD:{len:24,country:"Moldova",flag:"🇲🇩",currency:"MDL"},
  ME:{len:22,country:"Montenegro",flag:"🇲🇪",currency:"EUR"},
  NL:{len:18,country:"Netherlands",flag:"🇳🇱",currency:"EUR"},
  MK:{len:19,country:"North Macedonia",flag:"🇲🇰",currency:"MKD"},
  NO:{len:15,country:"Norway",flag:"🇳🇴",currency:"NOK"},
  OM:{len:23,country:"Oman",flag:"🇴🇲",currency:"OMR"},
  PK:{len:24,country:"Pakistan",flag:"🇵🇰",currency:"PKR"},
  PS:{len:29,country:"Palestine",flag:"🇵🇸",currency:"ILS"},
  PL:{len:28,country:"Poland",flag:"🇵🇱",currency:"PLN"},
  PT:{len:25,country:"Portugal",flag:"🇵🇹",currency:"EUR"},
  QA:{len:29,country:"Qatar",flag:"🇶🇦",currency:"QAR"},
  RO:{len:24,country:"Romania",flag:"🇷🇴",currency:"RON"},
  SM:{len:27,country:"San Marino",flag:"🇸🇲",currency:"EUR"},
  SA:{len:24,country:"Saudi Arabia",flag:"🇸🇦",currency:"SAR"},
  RS:{len:22,country:"Serbia",flag:"🇷🇸",currency:"RSD"},
  SC:{len:31,country:"Seychelles",flag:"🇸🇨",currency:"SCR"},
  SK:{len:24,country:"Slovakia",flag:"🇸🇰",currency:"EUR"},
  SI:{len:19,country:"Slovenia",flag:"🇸🇮",currency:"EUR"},
  ES:{len:24,country:"Spain",flag:"🇪🇸",currency:"EUR"},
  SE:{len:24,country:"Sweden",flag:"🇸🇪",currency:"SEK"},
  CH:{len:21,country:"Switzerland",flag:"🇨🇭",currency:"CHF"},
  TL:{len:23,country:"Timor-Leste",flag:"🇹🇱",currency:"USD"},
  TN:{len:24,country:"Tunisia",flag:"🇹🇳",currency:"TND"},
  TR:{len:26,country:"Turkey",flag:"🇹🇷",currency:"TRY"},
  UA:{len:29,country:"Ukraine",flag:"🇺🇦",currency:"UAH"},
  GB:{len:22,country:"United Kingdom",flag:"🇬🇧",currency:"GBP"},
  VA:{len:22,country:"Vatican City",flag:"🇻🇦",currency:"EUR"},
  CM:{len:27,country:"Cameroon",flag:"🇨🇲",currency:"XAF"},
  CF:{len:27,country:"Central African Republic",flag:"🇨🇫",currency:"XAF"},
  TD:{len:27,country:"Chad",flag:"🇹🇩",currency:"XAF"},
  CG:{len:27,country:"Republic of the Congo",flag:"🇨🇬",currency:"XAF"},
  GQ:{len:27,country:"Equatorial Guinea",flag:"🇬🇶",currency:"XAF"},
  GA:{len:27,country:"Gabon",flag:"🇬🇦",currency:"XAF"},
 
// NON-IBAN COUNTRIES
  US:{noIBAN:true,country:"United States",flag:"🇺🇸"},
  AU:{noIBAN:true,country:"Australia",flag:"🇦🇺"},
  CA:{noIBAN:true,country:"Canada",flag:"🇨🇦"},
  IN:{noIBAN:true,country:"India",flag:"🇮🇳"},
  CN:{noIBAN:true,country:"China",flag:"🇨🇳"},
  SG:{noIBAN:true,country:"Singapore",flag:"🇸🇬"},
  HK:{noIBAN:true,country:"Hong Kong",flag:"🇭🇰"},
  JP:{noIBAN:true,country:"Japan",flag:"🇯🇵"},
  KR:{noIBAN:true,country:"South Korea",flag:"🇰🇷"},
  TH:{noIBAN:true,country:"Thailand",flag:"🇹🇭"},
  MY:{noIBAN:true,country:"Malaysia",flag:"🇲🇾"},
  ID:{noIBAN:true,country:"Indonesia",flag:"🇮🇩"},
  PH:{noIBAN:true,country:"Philippines",flag:"🇵🇭"},
  BD:{noIBAN:true,country:"Bangladesh",flag:"🇧🇩"},
  LK:{noIBAN:true,country:"Sri Lanka",flag:"🇱🇰"},
  NP:{noIBAN:true,country:"Nepal",flag:"🇳🇵"},
  NG:{noIBAN:true,country:"Nigeria",flag:"🇳🇬"},
  KE:{noIBAN:true,country:"Kenya",flag:"🇰🇪"},
  GH:{noIBAN:true,country:"Ghana",flag:"🇬🇭"},
  ZA:{noIBAN:true,country:"South Africa",flag:"🇿🇦"},
  MX:{noIBAN:true,country:"Mexico",flag:"🇲🇽"},
  AR:{noIBAN:true,country:"Argentina",flag:"🇦🇷"},
  NZ:{noIBAN:true,country:"New Zealand",flag:"🇳🇿"},
  TW:{noIBAN:true,country:"Taiwan",flag:"🇹🇼"},
  VN:{noIBAN:true,country:"Vietnam",flag:"🇻🇳"},
  MM:{noIBAN:true,country:"Myanmar",flag:"🇲🇲"},
};
