# -*- coding: utf-8 -*-
import json, re

from data_bank1 import BANK1_AR
from data_bank2 import BANK2_AR
from data_bank3 import BANK3_AR
from data_bank4 import BANK4_AR

AR_DICTS = {
    1: BANK1_AR,
    2: BANK2_AR,
    3: BANK3_AR,
    4: BANK4_AR
}

with open('questions_clean.json', 'r', encoding='utf-8') as f:
    clean_questions = json.load(f)

print(f"Loaded {len(clean_questions)} clean questions.")

compiled_list = []
missing_ar = []

for q in clean_questions:
    bank_id = q['bank_id']
    q_num = q['q_num']
    ar_data = AR_DICTS.get(bank_id, {}).get(q_num)
    
    if not ar_data:
        missing_ar.append((bank_id, q_num))
        continue

    # Prepare options with Arabic translations
    options_compiled = []
    if q['type'] == 'mcq':
        for opt in q['options']:
            k = opt['key']
            opt_ar = ar_data.get('opts_ar', {}).get(k, '')
            options_compiled.append({
                'key': k,
                'text': opt['text'],
                'text_ar': opt_ar
            })
    else: # True/False
        options_compiled = [
            {'key': 'True', 'text': 'True', 'text_ar': 'صح (True)'},
            {'key': 'False', 'text': 'False', 'text_ar': 'خطأ (False)'}
        ]

    # Find answer text in English and Arabic
    ans_text_en = q.get('answer_text', '')
    ans_text_ar = ''
    if q['type'] == 'mcq':
        for opt in options_compiled:
            if opt['key'] == q['answer']:
                ans_text_ar = opt['text_ar']
    else:
        ans_text_ar = 'صح' if q['answer'] == 'True' else 'خطأ'

    item = {
        'id': q['id'],
        'bank_id': bank_id,
        'bank_title_en': q['bank_title_en'],
        'bank_title_ar': q['bank_title_ar'],
        'type': q['type'],
        'q_num': q_num,
        'question': q['question'],
        'question_ar': ar_data.get('q_ar', ''),
        'options': options_compiled,
        'answer': q['answer'],
        'answer_text': ans_text_en,
        'answer_text_ar': ans_text_ar,
        'explanation': q['explanation'],
        'explanation_ar': ar_data.get('exp_ar', ''),
        'reference': q.get('reference', '')
    }
    compiled_list.append(item)

print(f"Compiled: {len(compiled_list)} / {len(clean_questions)}")
if missing_ar:
    print(f"Missing Arabic data for: {missing_ar}")
else:
    print("ALL 160 QUESTIONS HAVE COMPLETE ARABIC TRANSLATIONS & EXPLANATIONS!")

# Write to JSON
with open('quiz_data.json', 'w', encoding='utf-8') as out_json:
    json.dump(compiled_list, out_json, ensure_ascii=False, indent=2)
print("Saved quiz_data.json")

# Write to JS
with open('quiz_data.js', 'w', encoding='utf-8') as out_js:
    out_js.write("// Auto-generated Quiz Questions Data (160 Questions across 4 Banks)\n")
    out_js.write("const QUIZ_DATA = ")
    json.dump(compiled_list, out_js, ensure_ascii=False, indent=2)
    out_js.write(";\n")
    out_js.write("if (typeof module !== 'undefined' && module.exports) { module.exports = QUIZ_DATA; }\n")
print("Saved quiz_data.js successfully!")
