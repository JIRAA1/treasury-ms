import re

with open('src/app/(admin)/admin/overview/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pending_pattern = re.compile(r'(\s*\{\/\*\s*Pending Payments Table\s*\*\/\}\s*<div className=\"lg:col-span-3.*?(?=\s*\{\/\*\s*Right Column\s*\*\/\}))', re.DOTALL)
pending_match = pending_pattern.search(content)

if not pending_match:
    print('Failed to find Pending Payments Table')
    exit(1)

pending_code = pending_match.group(1)
pending_code_fixed = pending_code.replace('lg:col-span-3 ', '')

right_col_pattern = re.compile(r'(\s*\{\/\*\s*Right Column\s*\*\/\}\s*<div className=\"lg:col-span-2 space-y-4\">\s*)(.*?)(\s*</div>\s*</div>\s*\{\/\*\s*Chart Row: Expense Donut \+ Cash Flow\s*\*\/\})', re.DOTALL)
right_col_match = right_col_pattern.search(content)

if not right_col_match:
    print('Failed to find Right Column')
    exit(1)

inner_cards = right_col_match.group(2)

balance_pattern = re.compile(r'(\{\/\*\s*Balance Card\s*\*\/\}.*?</div>\s*</div>\s*</div>)', re.DOTALL)
balance_code = balance_pattern.search(inner_cards).group(1)

payment_pattern = re.compile(r'(\{\/\*\s*Payment Rate Chart\s*\*\/\}.*?</PaymentRateChart>\s*</div>)', re.DOTALL)
payment_code = payment_pattern.search(inner_cards).group(1)

expected_pattern = re.compile(r'(\{\/\*\s*Expected vs Actual Chart\s*\*\/\}.*?</ExpectedVsActualChart>\s*</div>)', re.DOTALL)
expected_code = expected_pattern.search(inner_cards).group(1)

activity_pattern = re.compile(r'(\{\/\*\s*Activity\s*\*\/\}.*?</ActivityFeed>\s*</div>)', re.DOTALL)
activity_code = activity_pattern.search(inner_cards).group(1)

new_middle_section = f'''        {{/* Middle Section (Charts & Activities) */}}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
            {balance_code}

            {activity_code}
          </div>
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {payment_code}

            {expected_code}
          </div>
        </div>'''

old_middle_pattern = re.compile(r'\s*\{\/\*\s*Middle Section\s*\*\/\}.*?</div>\s*</div>\s*(?=\{\/\*\s*Chart Row: Expense Donut)', re.DOTALL)
content = old_middle_pattern.sub('\n' + new_middle_section + '\n\n        ', content)

end_pattern = re.compile(r'(\s*</div>\s*</div>\s*\)\s*\})')
new_content = end_pattern.sub(f'\n{pending_code_fixed}\\1', content)

with open('src/app/(admin)/admin/overview/page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Success')
