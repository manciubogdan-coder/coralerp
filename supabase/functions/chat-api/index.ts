import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'ensureDepartmentChannels') {
      const { userId, departments = [] } = body;
      for (const dept of departments.filter((d: string) => d && d !== 'admin')) {
        const { data: existing } = await db
          .from('chat_conversations')
          .select('id')
          .eq('type', 'department')
          .eq('department', dept)
          .maybeSingle();

        let convId = existing?.id;
        if (!convId) {
          const { data: created, error } = await db
            .from('chat_conversations')
            .insert({ type: 'department', department: dept, name: dept, created_by: userId })
            .select('id')
            .single();
          if (error) throw error;
          convId = created.id;
        }

        const { error: memberError } = await db
          .from('chat_members')
          .upsert({ conversation_id: convId, user_id: userId }, { onConflict: 'conversation_id,user_id' });
        if (memberError) throw memberError;
      }
      return json({ ok: true });
    }

    if (action === 'listConversations') {
      const { userId } = body;
      const { data: memberships, error: memError } = await db
        .from('chat_members')
        .select('conversation_id,last_read_at')
        .eq('user_id', userId);
      if (memError) throw memError;
      const ids = (memberships ?? []).map((m: any) => m.conversation_id);
      if (ids.length === 0) return json({ conversations: [] });
      const { data: conversations, error } = await db
        .from('chat_conversations')
        .select('id,type,name,department,created_by,updated_at')
        .in('id', ids)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return json({ conversations: conversations ?? [] });
    }

    if (action === 'listMessages') {
      const { conversationId } = body;
      const { data, error } = await db
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return json({ messages: data ?? [] });
    }

    if (action === 'sendMessage') {
      const { conversationId, userId, text } = body;
      const { error } = await db
        .from('chat_messages')
        .insert({ conversation_id: conversationId, author_id: userId, body: text });
      if (error) throw error;
      await db.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      return json({ ok: true });
    }

    if (action === 'createDM') {
      const { userId, otherUserId, name } = body;
      const { data: conv, error } = await db
        .from('chat_conversations')
        .insert({ type: 'dm', name: name || 'DM', created_by: userId })
        .select('id')
        .single();
      if (error) throw error;
      const { error: memberError } = await db.from('chat_members').insert([
        { conversation_id: conv.id, user_id: userId },
        { conversation_id: conv.id, user_id: otherUserId },
      ]);
      if (memberError) throw memberError;
      return json({ conversationId: conv.id });
    }

    if (action === 'createGroup') {
      const { userId, name, memberIds = [] } = body;
      const { data: conv, error } = await db
        .from('chat_conversations')
        .insert({ type: 'group', name, created_by: userId })
        .select('id')
        .single();
      if (error) throw error;
      const rows = Array.from(new Set([userId, ...memberIds])).map((uid) => ({ conversation_id: conv.id, user_id: uid }));
      const { error: memberError } = await db.from('chat_members').insert(rows);
      if (memberError) throw memberError;
      return json({ conversationId: conv.id });
    }

    return json({ error: 'Acțiune necunoscută' }, 400);
  } catch (error) {
    return json({ error: error?.message ?? 'Eroare chat' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
