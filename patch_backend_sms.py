import os
import shutil

voice_file = '../API/src/app/api/integrations/zavu/voice/route.ts'
sms_file = '../API/src/app/api/integrations/zavu/sms/route.ts'
os.makedirs(os.path.dirname(sms_file), exist_ok=True)
shutil.copyfile(voice_file, sms_file)

with open(sms_file, 'r') as f:
    content = f.read()

# Remove voice tools sync logic for sms
import re
content = re.sub(r'const VOICE_TOOLS_SCHEMA.*syncSiteToolsToZavu\(siteId, sender.id\);', '', content, flags=re.DOTALL)
content = re.sub(r'async function syncSiteToolsToZavu.*?}', '', content, flags=re.DOTALL)

content = content.replace('Voice Agent for Site', 'SMS Channel for Site')
content = content.replace('Voice Channel', 'SMS Channel')
content = content.replace('type: "voice"', 'type: "sms"')
content = content.replace('[Zavu Voice]', '[Zavu SMS]')
content = content.replace('create voice channel', 'create SMS channel')

# Delete leftover call
content = content.replace('await syncSiteToolsToZavu(siteId, sender.id);', '')

with open(sms_file, 'w') as f:
    f.write(content)
print("Created sms/route.ts")
