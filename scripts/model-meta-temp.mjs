const ids=[
'onnx-community/whisper-large-v3-turbo_timestamped',
'onnx-community/whisper-small_timestamped',
'onnx-community/whisper-base_timestamped',
'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
'mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
'mlc-ai/Qwen3-4B-q4f16_1-MLC'];
for(const id of ids) {
 try{
 const res=await fetch('https://huggingface.co/api/models/'+id);
 const data=await res.json();
 const readme=await fetch('https://huggingface.co/'+id+'/raw/'+data.sha+'/README.md');
 const text=readme.ok ? await readme.text() : '';
 console.log(JSON.stringify({id,sha:data.sha,license:data.cardData?.license ?? data.tags?.filter(t=>t.startsWith('license:')), files:data.siblings?.length,readmeFront:text.slice(0,380)}));
 }catch(e){console.log('ERROR '+id+' '+e.message)}
}
