import sys

with open('src/pages/CustomerLedger.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = []
new_content.extend(lines[:408])

new_content.append('      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">\n')
new_content.append('        <div className="flex flex-col gap-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] overflow-y-auto nav-scrollbar xl:pb-0 pb-10 pr-1">\n')
new_content.append('          <GlassCard className="p-5 shrink-0">\n')
new_content.extend(lines[410:468])

new_content.append('\n          {!isViewer && (\n')
new_content.append('            <GlassCard className="p-5 shrink-0">\n')
new_content.extend(lines[668:766])
new_content.append('          )}\n')
new_content.append('        </div>\n\n')

new_content.append('        <div className="space-y-5 min-w-0">\n')
new_content.extend(lines[471:664])
new_content.append('      </div>\n')

new_content.extend(lines[768:])

with open('src/pages/CustomerLedger.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_content)
