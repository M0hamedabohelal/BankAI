import re, json, sys

def clean_str(s):
    if not s:
        return ''
    s = re.sub(r'\n\s*\d+\s*\n\s*CS433[^\n]+', ' ', s)
    s = re.sub(r'CS433[^\n]+', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

doc_meta = {
    1: {
        "title_en": "Bank 1: Deep Learning I - Foundations",
        "title_ar": "بنك 1: أساسيات التعلم العميق (Deep Learning I: Foundations)",
        "fname": "document1_clean_raw.txt",
        "mcq_keys": ['c', 'a', 'd', 'b', 'a', 'c', 'd', 'b', 'c', 'a', 'd', 'b', 'c', 'a', 'b', 'd', 'c', 'a', 'd', 'b', 'c', 'a', 'd', 'b', 'c', 'a', 'c', 'd', 'b', 'a'],
        "tf_keys": ['True', 'False', 'False', 'True', 'False', 'True', 'True', 'False', 'True', 'False']
    },
    2: {
        "title_en": "Bank 2: The Whole Book in One Lecture",
        "title_ar": "بنك 2: نظرة شاملة على الذكاء الاصطناعي (AI: Whole Book Overview)",
        "fname": "document2_clean_raw.txt",
        "mcq_keys": ['b', 'd', 'a', 'c', 'b', 'a', 'd', 'c', 'a', 'b', 'd', 'c', 'b', 'a', 'c', 'd', 'b', 'a', 'c', 'd', 'a', 'b', 'c', 'd', 'b', 'a', 'd', 'c', 'b', 'a'],
        "tf_keys": ['True', 'False', 'True', 'False', 'True', 'True', 'False', 'False', 'True', 'False']
    },
    3: {
        "title_en": "Bank 3: Week 1 - What Is Artificial Intelligence?",
        "title_ar": "بنك 3: الأسبوع 1 - ما هو الذكاء الاصطناعي؟ (Introduction to AI)",
        "fname": "document3_clean_raw.txt",
        "mcq_keys": ['c', 'a', 'd', 'b', 'a', 'c', 'd', 'b', 'c', 'a', 'd', 'b', 'b', 'c', 'a', 'd', 'c', 'a', 'b', 'd', 'a', 'c', 'b', 'd', 'c', 'a', 'd', 'b', 'c', 'a'],
        "tf_keys": ['False', 'True', 'True', 'False', 'False', 'True', 'False', 'True', 'False', 'True']
    },
    4: {
        "title_en": "Bank 4: Week 5 - Deep Learning II: Architectures",
        "title_ar": "بنك 4: الأسبوع 5 - بنى وشبكات التعلم العميق (Architectures & CNNs)",
        "fname": "document4_clean_raw.txt",
        "mcq_keys": ['c', 'd', 'b', 'c', 'd', 'b', 'd', 'a', 'd', 'b', 'a', 'c', 'd', 'b', 'a', 'd', 'b', 'a', 'c', 'd', 'b', 'a', 'd', 'c', 'b', 'a', 'c', 'd', 'a', 'c'],
        "tf_keys": ['True', 'False', 'True', 'False', 'False', 'True', 'False', 'True', 'False', 'True']
    }
}

all_questions = []
global_id = 1

for doc in [1, 2, 3, 4]:
    cfg = doc_meta[doc]
    with open(cfg['fname'], 'r', encoding='utf-8') as f:
        t = f.read()
        
    if doc == 1:
        s_a = t.find('Choose the one best answer.')
        s_b = t.find('State whether each statement')
        e_b = t.rfind('3 Quick Answer Key')
        a_blocks = re.findall(r'(A\d+\..*?)(?=(?:A\d+\.|\Z))', t[s_a:s_b], re.DOTALL)
        b_blocks = re.findall(r'(B\d+\..*?)(?=(?:B\d+\.|\Z))', t[s_b:e_b], re.DOTALL)
    elif doc == 2:
        s_a = t.find('Choose the one best answer.')
        s_b = t.find('State whether each statement')
        e_b = t.rfind('3 Quick Answer Key')
        a_blocks = re.findall(r'(A\d+\..*?)(?=(?:A\d+\.|\Z))', t[s_a:s_b], re.DOTALL)
        b_blocks = re.findall(r'(B\d+\..*?)(?=(?:B\d+\.|\Z))', t[s_b:e_b], re.DOTALL)
    elif doc == 3:
        s_a = t.find('1 Part A – Multiple Choice', 500)
        s_b = t.find('Part B – True or False', s_a)
        e_b = t.rfind('3 Final Answer Key')
        a_blocks = re.findall(r'(A\d+\s*\nQuestion:.*?)(?=(?:A\d+\s*\nQuestion:|\Z))', t[s_a:s_b], re.DOTALL)
        b_blocks = re.findall(r'(B\d+\s*\nStatement:.*?)(?=(?:B\d+\s*\nStatement:|\Z))', t[s_b:e_b], re.DOTALL)
    elif doc == 4:
        s_a = t.find('Part A')
        s_b = t.find('Part B', s_a)
        e_b = t.rfind('Final')
        a_blocks = re.findall(r'(A\d+\..*?)(?=(?:A\d+\.|\Z))', t[s_a:s_b], re.DOTALL)
        b_blocks = re.findall(r'(B\d+\..*?)(?=(?:B\d+\.|\Z))', t[s_b:e_b], re.DOTALL)

    for i, block in enumerate(a_blocks):
        m_ans = re.search(r'\n\s*Correct\s*answer:?\s*', block, re.IGNORECASE)
        if not m_ans:
            m_ans = re.search(r'\n\s*Answer:?\s*', block, re.IGNORECASE)
        
        before_ans = block[:m_ans.start()]
        after_ans = block[m_ans.end():]

        ans_line = after_ans.split('\n')[0].strip()
        exp_m = re.search(r'Explanation\s*\(English\):?\s*(.*?)(?=\nReference:|\n[^\x00-\x7F]|\Z)', after_ans, re.DOTALL | re.IGNORECASE)
        exp = exp_m.group(1).strip() if exp_m else ''

        ref_m = re.search(r'Reference:?\s*(.*?)(?=\n[^\x00-\x7F]|\n\n|\Z)', after_ans, re.DOTALL | re.IGNORECASE)
        ref = ref_m.group(1).strip() if ref_m else ''

        opt_matches = list(re.finditer(r'(?:^|\n)\s*\(([a-d])\)\s*', before_ans))
        q_text = before_ans[:opt_matches[0].start()].strip()
        q_text = re.sub(r'^[AB]\d+[\.:\s]*\n*(?:Question:\s*|Statement:\s*)?', '', q_text).strip()

        options = []
        for j in range(len(opt_matches)):
            k = opt_matches[j].group(1).lower()
            s = opt_matches[j].end()
            e = opt_matches[j+1].start() if j+1 < len(opt_matches) else len(before_ans)
            opt_str = clean_str(before_ans[s:e])
            options.append({'key': k, 'text': opt_str})

        correct_key = cfg['mcq_keys'][i]
        ans_text = ''
        for opt in options:
            if opt['key'] == correct_key:
                ans_text = opt['text']

        all_questions.append({
            'id': global_id,
            'bank_id': doc,
            'bank_title_en': cfg['title_en'],
            'bank_title_ar': cfg['title_ar'],
            'type': 'mcq',
            'q_num': f'A{i+1}',
            'question': clean_str(q_text),
            'options': options,
            'answer': correct_key,
            'answer_text': ans_text,
            'explanation': clean_str(exp),
            'reference': clean_str(ref)
        })
        global_id += 1

    for i, block in enumerate(b_blocks):
        m_ans = re.search(r'\n\s*Correct\s*answer:?\s*', block, re.IGNORECASE)
        if not m_ans:
            m_ans = re.search(r'\n\s*Answer:?\s*', block, re.IGNORECASE)

        before_ans = block[:m_ans.start()]
        after_ans = block[m_ans.end():]

        corr_stmt_m = re.search(r'(?:Correct statement|Correction):\s*(.*?)(?=\nExplanation|\nReference:|\Z)', after_ans, re.DOTALL | re.IGNORECASE)
        corr_stmt = clean_str(corr_stmt_m.group(1)) if corr_stmt_m else ''

        exp_m = re.search(r'Explanation\s*\(English\):?\s*(.*?)(?=\nReference:|\n[^\x00-\x7F]|\Z)', after_ans, re.DOTALL | re.IGNORECASE)
        if exp_m:
            exp = clean_str(exp_m.group(1))
        else:
            # doc 3 style
            exp_m3 = re.search(r'^\s*(.*?)(?=\nCorrection:|\nReference:|\n[^\x00-\x7F]|\Z)', after_ans, re.DOTALL)
            exp = clean_str(exp_m3.group(1)) if exp_m3 else ''

        ref_m = re.search(r'Reference:?\s*(.*?)(?=\n[^\x00-\x7F]|\n\n|\Z)', after_ans, re.DOTALL | re.IGNORECASE)
        ref = clean_str(ref_m.group(1)) if ref_m else ''

        q_text = re.sub(r'^[AB]\d+[\.:\s]*\n*(?:Statement:\s*|Question:\s*)?', '', before_ans).strip()

        correct_tf = cfg['tf_keys'][i]

        options = [
            {'key': 'True', 'text': 'True'},
            {'key': 'False', 'text': 'False'}
        ]

        full_exp = exp
        if corr_stmt:
            full_exp = f"Correct Statement: {corr_stmt}\n\nExplanation: {exp}"

        all_questions.append({
            'id': global_id,
            'bank_id': doc,
            'bank_title_en': cfg['title_en'],
            'bank_title_ar': cfg['title_ar'],
            'type': 'tf',
            'q_num': f'B{i+1}',
            'question': clean_str(q_text),
            'options': options,
            'answer': correct_tf,
            'answer_text': correct_tf,
            'correct_statement': corr_stmt,
            'explanation': full_exp,
            'reference': clean_str(ref)
        })
        global_id += 1

with open('questions_clean.json', 'w', encoding='utf-8') as out_f:
    json.dump(all_questions, out_f, ensure_ascii=False, indent=2)

print(f"Done! Extracted {len(all_questions)} questions into questions_clean.json")
