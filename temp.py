import re

with open('src/app/(admin)/admin/overview/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

pending_table = re.search(r'(\s*\{\/\*\s*Pending Payments Table\s*\*\/\}.*?)(?=\s*\{\/\*\s*Right Column\s*\*\/})', text, re.DOTALL).group(1)

text = text.replace(pending_table, '')
text = text.replace('<div className="grid grid-cols-1 lg:grid-cols-5 gap-4">', '<div className="grid grid-cols-1 lg:grid-cols-4 gap-4">')
text = text.replace('<div className="lg:col-span-2 space-y-4">', '<div className="lg:col-span-1 space-y-4">')

charts_content = re.search(r'(\s*\{\/\*\s*Payment Rate Chart\s*\*\/\}.*?)(?=\s*\{\/\*\s*Activity\s*\*\/})', text, re.DOTALL).group(1)
text = text.replace(charts_content, '')

new_charts_content = f'\n          </div>\n          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">{charts_content}'
text = text.replace('            {/* Activity */}', new_charts_content + '            {/* Activity */}')

pending_table = pending_table.replace('lg:col-span-3 ', '')
text = text.replace('      </div>\n    </div>\n  )\n}', pending_table + '\n      </div>\n    </div>\n  )\n}')

with open('src/app/(admin)/admin/overview/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
