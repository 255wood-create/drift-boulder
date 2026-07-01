with open('src/App.jsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip_until_close = False

for i, line in enumerate(lines):
    # Remove old sbFetch function
    if 'async function sbFetch(' in line:
        skip_until_close = True
        continue
    if skip_until_close and line.strip() == '}':
        skip_until_close = False
        continue
    if skip_until_close:
        continue
    
    # Replace fetchEventsFromDb
    if 'async function fetchEventsFromDb' in line:
        new_lines.append('async function fetchEventsFromDb(){\n')
        new_lines.append("  const { data, error } = await supabase.from('events').select('*').order('starts_at');\n")
        new_lines.append('  if (error) throw new Error(error.message);\n')
        new_lines.append('  return data || [];\n')
        new_lines.append('}\n')
        # Skip old function body
        j = i + 1
        while j < len(lines) and lines[j].strip() != '}':
            j += 1
        for k in range(i+1, min(j+1, len(lines))):
            lines[k] = ''
        continue
    
    # Replace toggleSavedDb
    if 'async function toggleSavedDb' in line:
        new_lines.append('async function toggleSavedDb(userId, eventId, wasSaved){\n')
        new_lines.append("  if(wasSaved) await supabase.from('saved_events').delete().match({user_id:userId, event_id:eventId});\n")
        new_lines.append("  else await supabase.from('saved_events').insert({user_id:userId, event_id:eventId});\n")
        new_lines.append('}\n')
        j = i + 1
        while j < len(lines) and lines[j].strip() != '}':
            j += 1
        for k in range(i+1, min(j+1, len(lines))):
            lines[k] = ''
        continue
    
    # Replace toggleIntDb
    if 'async function toggleIntDb' in line:
        new_lines.append('async function toggleIntDb(userId, eventId, wasInt){\n')
        new_lines.append("  if(wasInt) await supabase.from('interested').delete().match({user_id:userId, event_id:eventId});\n")
        new_lines.append("  else await supabase.from('interested').insert({user_id:userId, event_id:eventId});\n")
        new_lines.append('}\n')
        j = i + 1
        while j < len(lines) and lines[j].strip() != '}':
            j += 1
        for k in range(i+1, min(j+1, len(lines))):
            lines[k] = ''
        continue
    
    if line.strip():
        new_lines.append(line)
    elif new_lines and new_lines[-1].strip():
        new_lines.append(line)

with open('src/App.jsx', 'w') as f:
    f.writelines(new_lines)

content = ''.join(new_lines)
print("Done!")
print("Has sbFetch:", "sbFetch" in content)
print("Has supabase.from:", "supabase.from" in content)
