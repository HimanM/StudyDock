"""Package the extension's exact review renderer into a self-contained HTML file."""
import json
import re


def filename(title):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', str(title or 'Practice exam')).strip().rstrip('. ')[:140] or 'Practice exam'
    return '_' + name if re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', name, re.I) else name


def render(data, extension):
    values = {key: (extension / file).read_text(encoding='utf-8-sig').replace('</script', '<\\/script')
              for key, file in {'CONTENT': 'review-content.js', 'BOOT': 'offline-review.js', 'REVIEW': 'review.js'}.items()}
    values['DATA'] = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    shell = (extension / 'portable-shell.html').read_text(encoding='utf-8')
    return re.sub(r'\{\{(DATA|CONTENT|BOOT|REVIEW)\}\}', lambda match: values[match[1]], shell)
