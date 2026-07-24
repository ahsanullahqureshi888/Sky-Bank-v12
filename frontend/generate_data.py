import re

markdown = """
| S.NO | Cash In (USD) | Cash Out (USD) | Balance (USD) | Sarafi / Associated Entity |
| --- | --- | --- | --- | --- |
| **1** | $8,000 | $0 | $8,000 | **Naseri Sarafi**<br> |
| **2** | $20,000 | $0 | $28,000 | Cash Sarafi / Hassan Sharif LTD |
| **3** | $15,000 | $0 | $43,000 | Cash Sarafi / Hassan Sharif LTD |
| **4** | $10,000 | $0 | $53,000 | **Omid Ehsan Sarafi**<br> |
| **5** | $21,000 | $0 | $74,000 | Cash Sarafi / Hassan Sharif LTD |
| **6** | $1,180 | $0 | $75,180 | Cash Sarafi / Hassan Sharif LTD |
| **7** | $25,000 | $0 | $100,180 | Rahmat Nazar LTD |
| **8** | $0 | $7,000 | $93,180 | Nazar Muhmmad Yarmal |
| **9** | $4,000 | $0 | $97,180 | Hamid Insaf LTD |
| **10** | $27,300 | $0 | $124,480 | **Nawi Taimoor Shahi Sarafi**<br> |
| **11** | $4,300 | $0 | $128,780 | Hamid Insaf LTD |
| **12** | $22,520 | $0 | $151,300 | **Nawi Taimoor Shahi Sarafi**<br> |
| **13** | $25,000 | $0 | $176,300 | Ghami Nazir LTD |
| **14** | $10,000 | $0 | $186,300 | Ghami Nazir LTD |
| **15** | $29,300 | $0 | $215,600 | Cash Sarafi / Hassan Sharif LTD |
| **16** | $10,000 | $0 | $225,600 | **Taimoor Shahi Sarafi**<br> |
| **17** | $10,000 | $0 | $235,600 | Ghami Nazir LTD |
| **18** | $10,000 | $0 | $245,600 | Ghami Nazir LTD |
| **19** | $0 | $780 | $244,820 | Ghami Nazir LTD / Nazar Muhammad |
| **20** | $30,000 | $0 | $274,820 | Rahmat Nazar LTD |
| **21** | $4,800 | $0 | $279,620 | Hamid Insaf LTD |
| **22** | $12,000 | $0 | $291,620 | Ghami Nazir LTD |
| **23** | $5,000 | $0 | $296,620 | Ghami Nazir LTD |
| **24** | $0 | $21,212 | $275,408 | Haji Dawood Herat |
| **25** | $0 | $1,515 | $273,893 | Ghami Nazir LTD / Nazar Muhammad |
| **26** | $20,000 | $0 | $293,893 | **Nawi Taimoor Shahi Sarafi**<br> |
| **27** | $7,518 | $0 | $301,411 | Hayatullah Khan Fazli LTD |
| **28** | $30,000 | $0 | $331,411 | Wasteland LTD |
| **29** | $15,000 | $0 | $346,411 | **Mujahid Sarafi**<br> |
| **30** | $20,000 | $0 | $366,411 | Rahmat Nazar LTD |
| **31** | $16,520 | $0 | $382,931 | **Nawi Taimoor Shahi Sarafi**<br> |
| **32** | $0 | $1,136 | $381,795 | Nazar Muhmmad Yarmal |
| **33** | $0 | $984 | $380,811 | Nazar Muhmmad Yarmal |
| **34** | $20,000 | $0 | $400,811 | Ghami Nazir LTD |
| **35** | $10,000 | $0 | $410,811 | Ghami Nazir LTD |
| **36** | $0 | $15,151 | $395,660 | **Omid Ehsan Sarafi**<br> |
| **37** | $20,000 | $0 | $415,660 | **Taimoor Shahi Sarafi**<br> |
| **38** | $7,530 | $0 | $423,190 | Cash Sarafi / Hassan Sharif LTD |
| **39** | $25,000 | $0 | $448,190 | Najeb Amin LTD |
| **40** | $20,000 | $0 | $468,190 | Najib Asad LTD |
| **41** | $7,780 | $0 | $475,970 | Ghami Nazir LTD |
| **42** | $27,072 | $0 | $503,042 | Ghami Nazir LTD |
| **43** | $3,430 | $0 | $506,472 | Noor Qayaam LTD / Haji Atiq Chaman |
| **44** | $3,800 | $0 | $510,272 | Hamid Insaf LTD |
| **45** | $23,240 | $0 | $533,512 | Ghami Nazir LTD |
| **46** | $0 | $7,575 | $525,937 | Haji Dawood Herat |
| **47** | $10,000 | $0 | $535,937 | **Naseri Sarafi**<br> |
| **48** | $10,000 | $0 | $545,937 | Ghami Nazir LTD |
| **49** | $20,000 | $0 | $565,937 | **Nawi Taimoor Shahi Sarafi**<br> |
| **50** | $678 | $0 | $566,615 | Hassan Sharif LTD |
| **51** | $60,000 | $0 | $626,615 | Cash Sarafi / Hayatullah Khan Fazli LTD |
| **52** | $15,000 | $0 | $641,615 | Najib Asad LTD |
| **53** | $15,000 | $0 | $656,615 | **Nawi Taimoor Shahi Sarafi**<br> |
| **54** | $0 | $18,181 | $638,434 | **Omid Ehsan Sarafi**<br> |
| **55** | $6,811 | $0 | $645,245 | Nisar Ahmad Wakil Ahmad |
| **56** | $0 | $3,030 | $642,215 | Ghami Nazir LTD / Nazar Muhammad |
| **57** | $2,500 | $0 | $644,715 | Hamid Insaf LTD |
| **58** | $20,000 | $0 | $664,715 | Ghami Nazir LTD |
| **59** | $20,000 | $0 | $684,715 | Ghami Nazir LTD |
| **60** | $15,000 | $0 | $699,715 | Cash Sarafi / Hassan Sharif LTD |
| **61** | $25,000 | $0 | $724,715 | Ghami Nazir LTD |
| **62** | $5,000 | $0 | $729,715 | **Taimoor Shahi Sarafi** / **Azizi Sarafi**<br> |
| **63** | $50,000 | $0 | $779,715 | Afghan United Bank / Najeb Amin LTD |
| **64** | $0 | $2,954 | $776,761 | Ghami Nazir LTD / Nazar Muhammad |
| **65** | $13,000 | $0 | $789,761 | Hassan Sharif LTD |
| **66** | $20,000 | $0 | $809,761 | Cash Sarafi / Haji Abdul Wase Khan Alokozay |
| **67** | $10,000 | $0 | $819,761 | Ghami Nazir LTD |
| **68** | $250,000 | $0 | $1,069,761 | **Nawi Taimoor Shahi Sarafi**<br> |
| **69** | $0 | $463 | $1,069,298 | Haji Dawood Herat |
| **70** | $15,000 | $0 | $1,084,298 | Najib Asad LTD |
| **71** | $40,000 | $0 | $1,124,298 | Afghan United Bank / Najeb Amin LTD |
| **72** | $9,700 | $0 | $1,133,998 | Noor Qayaam LTD |
| **73** | $680 | $0 | $1,134,678 | Cash Sarafi / Hassan Sharif LTD |
| **74** | $0 | $43,746 | $1,090,932 | Cash Sarafi / Rahmatullah Rahmat |
| **75** | $15,000 | $0 | $1,105,932 | Najib Asad LTD |
| **76** | $19,000 | $0 | $1,124,932 | Wasela LTD |
| **77** | $10,000 | $0 | $1,134,932 | Ghami Nazir LTD |
| **78** | $5,000 | $0 | $1,139,932 | **Azizi Sarafi**<br> |
| **79** | $10,000 | $0 | $1,149,932 | **Nawi Taimoor Shahi Sarafi**<br> |
| **80** | $20,000 | $0 | $1,169,932 | Najib Asad LTD |
| **81** | $0 | $1,742 | $1,168,190 | Nazar Muhmmad Yarmal |
| **82** | $5,000 | $0 | $1,173,190 | Cash Sarafi / Hassan Sharif LTD |
| **83** | $10,000 | $0 | $1,183,190 | Haji Abdul Wase Khan Alokozay |
| **84** | $7,360 | $0 | $1,190,550 | Cash Sarafi / Hassan Sharif LTD |
| **85** | $25,000 | $0 | $1,215,550 | Ghami Nazir LTD |
| **86** | $500 | $0 | $1,216,050 | Cash Sarafi / Hassan Sharif LTD |
| **87** | $13,000 | $0 | $1,229,050 | **Naseri Sarafi**<br> |
| **88** | $8,000 | $0 | $1,237,050 | Hassan Sharif LTD |
| **89** | $0 | $1,515 | $1,235,535 | Nazar Muhmmad Yarmal |
| **90** | $10,000 | $0 | $1,245,535 | Nisar Ahmad Wakil Ahmad |
| **91** | $10,000 | $0 | $1,255,535 | Rahmat Nazar LTD |
| **92** | $0 | $15,151 | $1,240,384 | Haji Noor Muhmmad |
| **93** | $15,000 | $0 | $1,255,384 | Haji Abdul Wase Khan Alokozay |
| **94** | $0 | $4,545 | $1,250,839 | Haji Noor Muhmmad |
| **95** | $4,400 | $0 | $1,255,239 | Cash Sarafi / Hassan Sharif LTD |
| **96** | $0 | $7,575 | $1,247,664 | Haji Noor Muhmmad |
| **97** | $10,534 | $0 | $1,258,198 | Rahmat Nazar LTD |
| **98** | $30,000 | $0 | $1,288,198 | **Omid Ehsan Sarafi**<br> |
| **99** | $0 | $303 | $1,287,895 | Nazar Muhmmad Yarmal |
| **100** | $15,000 | $0 | $1,302,895 | **Taimoor Shahi Sarafi**<br> |
| **101** | $10,000 | $0 | $1,312,895 | **Azmat Arya Sarafi**<br> |
| **102** | $20,000 | $0 | $1,332,895 | Nisar Ahmad Wakil Ahmad |
| **103** | $50,000 | $0 | $1,382,895 | Najeb Amin LTD |
| **104** | $3,150 | $0 | $1,386,045 | Abdul Mateen Zarbalag Ltd |
| **105** | $15,000 | $0 | $1,401,045 | **Faisal Shirzad Sarafi**<br> |
| **106** | $10,000 | $0 | $1,411,045 | Cash Sarafi / Hassan Sharif LTD |
| **107** | $20,000 | $0 | $1,431,045 | **Omid Ehsan Sarafi**<br> |
| **108** | $1,053 | $0 | $1,432,098 | **Azmat Arya Sarafi**<br> |
| **109** | $25,000 | $0 | $1,457,098 | Rahmat Nazar LTD |
| **110** | $10,500 | $0 | $1,467,598 | **Faisal Shirzad Sarafi**<br> |
| **111** | $15,000 | $0 | $1,482,598 | **Naseri Sarafi**<br> |
| **112** | $0 | $1,818 | $1,480,780 | Nazar Muhmmad Yarmal |
| **113** | $0 | $3,787 | $1,476,993 | Haji Noor Muhmmad |
| **114** | $1,500 | $0 | $1,478,493 | **Omid Ehsan Sarafi**<br> |
| **115** | $2,000 | $0 | $1,480,493 | **Azizi Sarafi**<br> |
| **116** | $10,000 | $0 | $1,490,493 | **Omid Ehsan Sarafi**<br> |
| **117** | $0 | $3,030 | $1,487,463 | Haji Noor Muhmmad |
| **118** | $30,000 | $0 | $1,517,463 | Najeb Amin LTD |
| **119** | $15,000 | $0 | $1,532,463 | **Omid Ehsan Sarafi**<br> |
| **120** | $15,000 | $0 | $1,547,463 | **Omid Ehsan Sarafi** / **Azizi Sarafi**<br> |
| **121** | $15,000 | $0 | $1,562,463 | Rahmat Nazar LTD |
| **122** | $26,000 | $0 | $1,588,463 | **Omid Ehsan Sarafi**<br> |
| **123** | $15,000 | $0 | $1,603,463 | Demurrage Account |
| **124** | $32,000 | $0 | $1,635,463 | Najeb Amin LTD |
| **125** | $5,000 | $0 | $1,640,463 | Cash Sarafi / Hassan Sharif LTD |
| **126** | $15,000 | $0 | $1,655,463 | Nisar Ahmad Wakil Ahmad |
| **127** | $26,000 | $0 | $1,681,463 | **Omid Ehsan Sarafi**<br> |
| **128** | $0 | $86,000 | $1,595,463 | Noor Ahmad |
| **129** | $15,000 | $0 | $1,610,463 | **Omid Ehsan Sarafi**<br> |
| **130** | $15,000 | $0 | $1,625,463 | Demurrage Account |
| **131** | $20,000 | $0 | $1,645,463 | Sky Ariana & Balam Bar Baran |
| **132** | $32,000 | $0 | $1,677,463 | HAJI-BASHIR-NAJEB-AMIN-LTD |
| **133** | $25,000 | $0 | $1,702,463 | Obaid Kawsar LTD |
| **134** | $10,000 | $0 | $1,712,463 | **Omid Ehsan Sarafi**<br> |
| **135** | $0 | $6,658 | $1,705,805 | Nisar Ahmad Wakil Ahmad |
| **136** | $6,500 | $0 | $1,712,305 | Hassan Sharif LTD |
| **137** | $0 | $9,970 | $1,702,335 | **Haji Ezzatullah Sarafi** / Haji Atiq Pak Afghan |
| **138** | $15,000 | $0 | $1,717,335 | **Omid Ehsan Sarafi**<br> |
| **139** | $10,000 | $0 | $1,727,335 | Abdul Wase Alokozay |
| **140** | $0 | $8,175 | $1,719,160 | Shohra Hashempour (Dubai Account) |
| **141** | $1,556 | $0 | $1,720,716 | Hassan Sharif LTD |
| **142** | $5,770 | $0 | $1,726,486 | **Azmat Arya Sarafi** / **Nawi Taimoor Shahi Sarafi**<br> |
| **143** | $25,000 | $0 | $1,751,486 | **Azmat Arya Sarafi**<br> |
| **144** | $1,000 | $0 | $1,752,486 | **Azizi Sarafi**<br> |
| **145** | $10,000 | $0 | $1,762,486 | Najib Asad LTD |
| **146** | $3,000 | $0 | $1,765,486 | Haji Abdul Wase Khan Alokozay |
| **147** | $1,556 | $0 | $1,767,042 | Hassan Sharif LTD |
| **148** | $16,000 | $0 | $1,783,042 | **Omid Ehsan Sarafi**<br> |
| **149** | $2,326 | $0 | $1,785,368 | **Sarafi Market** / Hassan Sharif LTD |
| **150** | $20,500 | $0 | $1,805,868 | **Abdul Sami Akrami Saraf**<br> |
| **151** | $2,315 | $0 | $1,808,183 | **Sarafi Market** / Hassan Sharif LTD |
| **152** | $5,000 | $0 | $1,813,183 | Nisar Ahmad Wakil Ahmad |
| **153** | $0 | $12,122 | $1,801,061 | Haji Omar Nimroz |
| **154** | $0 | $7,878 | $1,793,183 | **Omid Ehsan Sarafi**<br> |
| **155** | $0 | $11,905 | $1,781,278 | **Omid Ehsan Sarafi**<br> |
| **156** | $0 | $2,286 | $1,778,992 | Sarafi Market / Sky Ariana LTD |
| **157** | $0 | $715 | $1,778,277 | **Haji Omar Sarafi**<br> |
| **158** | $1,000 | $0 | $1,779,277 | **Azizi Sarafi**<br> |
| **159** | $6,000 | $0 | $1,785,277 | Najeb Amin LTD |
| **160** | $8,000 | $0 | $1,793,277 | Khujandi LTD |
| **161** | $2,286 | $0 | $1,795,563 | Hassan Sharif LTD |
| **162** | $20,000 | $0 | $1,815,563 | **Omid Ehsan Sarafi**<br> |
| **163** | $0 | $17,647 | $1,797,916 | **Omid Ehsan Sarafi**<br> |
| **164** | $10,000 | $0 | $1,807,916 | Haji Taimoor Shah Account |
| **165** | $0 | $30,000 | $1,777,916 | **Omid Ehsan Sarafi**<br> |
| **166** | $92,700 | $0 | $1,870,616 | Haji Ibrahim |
| **167** | $40,000 | $0 | $1,910,616 | **Omid Ehsan Sarafi**<br> |
| **168** | $34,246 | $0 | $1,944,862 | Rohit Bhai |
| **169** | $0 | $10,150 | $1,934,712 | **Nawi Taimoor Shahi Sarafi**<br> |
| **170** | $10,000 | $0 | $1,944,712 | Rahmat Nazar LTD |
| **171** | $2,286 | $0 | $1,946,998 | Hassan Sharif LTD |
"""

out = []
for line in markdown.strip().split('\n'):
    if line.startswith('| **'):
        parts = line.split('|')
        if len(parts) >= 6:
            sn = parts[1].strip().replace('**', '')
            cash_in = parts[2].strip().replace('$', '').replace(',', '')
            cash_out = parts[3].strip().replace('$', '').replace(',', '')
            entity = parts[5].strip().replace('**', '').replace('<br>', '')
            out.append(f'  {{ serialNumber: {sn}, cashIn: {cash_in}, cashOut: {cash_out}, associatedEntity: "{entity}" }},')

import os
os.makedirs(r'c:\Users\HomePC\Documents\sky banking\frontend\src\data', exist_ok=True)
os.makedirs(r'c:\Users\HomePC\Documents\sky banking\frontend\src\types', exist_ok=True)

with open(r'c:\Users\HomePC\Documents\sky banking\frontend\src\data\ledgerData.ts', 'w', encoding='utf-8') as f:
    f.write('import { LedgerTransactionInput } from "../types/ledger";\n\n')
    f.write('export const rawLedgerData: LedgerTransactionInput[] = [\n')
    f.write('\n'.join(out))
    f.write('\n];\n')

print('Data extracted successfully.')
