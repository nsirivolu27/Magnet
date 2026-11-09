import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  Switch,
  Text as NativeText,
  TextInput,
  View,
} from "react-native";

import {
  MagnetClient,
  messageOf,
  normalizeBaseUrl,
  type Analysis,
  type ConnectorStatus,
  type Conversation,
  type ConversationSummary,
  type HandoffSummary,
  type ImportPreview,
  type IssuedHandoff,
  type Lineage,
  type Stats,
} from "./src/api";
import { useTheme } from "./src/styles";
import { clearConnection, loadConnection, saveConnection, type StoredConnection } from "./src/storage";
import { archiveChoices, downloadText, readerUrl } from "./src/transfer";

type Tab = "home" | "library" | "import" | "handoffs" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "New conversation" },
  { id: "library", label: "All conversations" },
  { id: "import", label: "Import or receive" },
  { id: "handoffs", label: "Shared links" },
  { id: "settings", label: "Settings" },
];

const DEFAULT_URL = process.env.EXPO_PUBLIC_MAGNET_API_URL
  ?? process.env.EXPO_PUBLIC_LNKZ_API_URL
  ?? (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "http://localhost:3100");

export default function App() {
  const { styles, colors, dark } = useTheme();
  const [booting, setBooting] = useState(true);
  const [connection, setConnection] = useState<StoredConnection | null>(null);

  useEffect(() => {
    loadConnection()
      .then(setConnection)
      .catch(() => setConnection(null))
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <StatusBar style={dark ? "light" : "dark"} />
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.mono}>Opening Magnet…</Text>
      </SafeAreaView>
    );
  }

  if (!connection) {
    return <ConnectionScreen onConnected={setConnection} />;
  }

  return <RelayApp connection={connection} onDisconnect={() => setConnection(null)} />;
}

function ConnectionScreen({ onConnected }: { onConnected: (connection: StoredConnection) => void }) {
  const { styles, dark } = useTheme();
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const normalized = normalizeBaseUrl(baseUrl);
      const candidate = { baseUrl: normalized, apiKey: apiKey.trim() };
      // /ready first, then an authenticated call. Separating them is what lets
      // the error say whether the URL is wrong or the key is, instead of one
      // "could not connect" covering both.
      await new MagnetClient(candidate.baseUrl, candidate.apiKey).checkConnection();
      await saveConnection(candidate);
      onConnected(candidate);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.connectionPage} keyboardShouldPersistTaps="handled">
        <Text style={styles.connectionTitle}>Magnet</Text>
        <Text style={styles.hero}>Bring your conversations together.</Text>
        <Text style={styles.copy}>Connect to your Magnet address to save conversations and share them with someone else.</Text>
        <Field label="Magnet address" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" keyboardType="url" />
        <Field label="Access key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" secureTextEntry />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Action label={busy ? "Connecting…" : "Continue"} onPress={connect} disabled={busy} />
        <Text style={styles.hint}>Use the address and access key from your Magnet setup. Your connection is remembered on this device.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RelayApp({ connection, onDisconnect }: { connection: StoredConnection; onDisconnect: () => void }) {
  const { styles, colors, dark } = useTheme();
  const client = useMemo(() => new MagnetClient(connection.baseUrl, connection.apiKey), [connection]);
  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const requestVersion = useRef(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ conversation: Conversation; analysis: Analysis } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      client.stats(),
      client.connectors(),
      client.listConversations(),
      client.listHandoffs(),
    ]);
    if (results[0].status === "fulfilled") setStats(results[0].value.stats);
    if (results[1].status === "fulfilled") setConnectors(results[1].value.connectors);
    if (results[2].status === "fulfilled") setConversations(results[2].value.conversations);
    if (results[3].status === "fulfilled") setHandoffs(results[3].value.handoffs);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") setError(messageOf(failure.reason));
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [client]);

  const openConversation = async (id: string) => {
    const version = ++requestVersion.current;
    setBusy("conversation");
    setError("");
    setMenuOpen(false);
    setTab("home");
    setSelected(null);
    setSelectedId(id);
    try {
      const result = await client.getConversation(id);
      if (version === requestVersion.current) setSelected(result);
    } catch (cause) {
      if (version === requestVersion.current) setError(messageOf(cause));
    } finally {
      if (version === requestVersion.current) setBusy("");
    }
  };

  const selectTab = (next: Tab) => {
    ++requestVersion.current;
    setBusy("");
    setNotice("");
    setError("");
    setMenuOpen(false);
    if (next === "home") { setSelected(null); setSelectedId(null); }
    setTab(next);
  };

  const disconnect = async () => {
    await clearConnection();
    onDisconnect();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={menuOpen ? "Close navigation" : "Open navigation"} style={styles.iconButton} onPress={() => setMenuOpen(!menuOpen)}><Text style={styles.menuIcon}>☰</Text></Pressable>
        <Text style={styles.headerBrand}>Magnet</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="New conversation" style={styles.iconButton} onPress={() => selectTab("home")}><Text style={styles.menuIcon}>＋</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
        {tab === "home" ? (
          <ChatView key={selectedId ?? "new"} client={client} value={selected} loading={busy === "conversation"} onSaved={async (id) => { await refresh(); await openConversation(id); }} onImport={() => selectTab("import")} onShare={() => selectTab("handoffs")} />
        ) : <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
        {tab === "library" && <Library client={client} conversations={conversations} onOpen={openConversation} />}
        {tab === "import" && (
          <ImportView
            client={client}
            busy={busy}
            setBusy={setBusy}
            onImported={async (conversation) => {
              setNotice(`Imported “${conversation.title}”.`);
              await refresh();
              await openConversation(conversation.id);
            }}
            setError={setError}
          />
        )}
        {tab === "handoffs" && (
          <HandoffsView
            client={client}
            conversations={conversations}
            handoffs={handoffs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            refresh={refresh}
            setError={setError}
            setNotice={setNotice}
          />
        )}
        {tab === "settings" && (
          <SettingsView connection={connection} stats={stats} connectors={connectors} client={client} disconnect={disconnect} setError={setError} setNotice={setNotice} />
        )}
        </ScrollView>}
      </KeyboardAvoidingView>
      {menuOpen ? <View style={styles.menuOverlay}>
        <Pressable accessibilityLabel="Close navigation" accessibilityRole="button" style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
        <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
          {TABS.map((item) => <Pressable key={item.id} accessibilityRole="button" style={[styles.navItem, tab === item.id && styles.navItemActive]} onPress={() => selectTab(item.id)}><Text style={styles.navLabel}>{item.label}</Text></Pressable>)}
          <SectionTitle>Recent conversations</SectionTitle>
          {conversations.slice(0, 20).map((item) => <Pressable key={item.id} accessibilityRole="button" style={styles.navItem} onPress={() => void openConversation(item.id)}><Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text></Pressable>)}
          {!conversations.length ? <Text style={styles.hint}>Your conversations will appear here.</Text> : null}
        </ScrollView>
      </View> : null}
    </SafeAreaView>
  );
}

function Library({ client, conversations, onOpen }: {
  client: MagnetClient;
  conversations: ConversationSummary[];
  onOpen: (id: string) => Promise<void>;
}) {
  const { styles } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConversationSummary[]>(conversations);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => { if (!query.trim()) setResults(conversations); }, [conversations, query]);

  const search = async () => {
    if (!query.trim()) { setResults(conversations); return; }
    setSearching(true);
    setSearchError("");
    try { setResults((await client.searchConversations(query.trim())).matches); }
    catch (cause) { setSearchError(messageOf(cause)); }
    finally { setSearching(false); }
  };

  return (
    <View>
      <Text style={styles.pageTitle}>Your conversations</Text>
      {searchError ? <Notice tone="error">{searchError}</Notice> : null}
      <Field label="Search" value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={() => void search()} placeholder="Decisions, topics, people…" />
      <Action label={searching ? "SearchING…" : "Search LIBRARY"} onPress={search} secondary disabled={searching} />
      <View style={styles.divider} />
      {results.map((item, index) => (
        <ConversationRow key={item.id} item={item} index={index + 1} onPress={() => void onOpen(item.id)} />
      ))}
      {!results.length ? <Empty>No matching conversations.</Empty> : null}
    </View>
  );
}

function ChatView({ client, value, loading, onSaved, onImport, onShare }: {
  client: MagnetClient;
  value: { conversation: Conversation; analysis: Analysis } | null;
  loading: boolean;
  onSaved: (id: string) => Promise<void>;
  onImport: () => void;
  onShare: () => void;
}) {
  const { styles, colors } = useTheme();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [details, setDetails] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const send = async () => {
    const content = draft.trim();
    if (!content || saving || loading) return;
    setSaving(true); setProblem("");
    try {
      const result = value
        ? await client.appendMessage(value.conversation.id, { role: "user", content })
        : await client.createConversation(content);
      setDraft("");
      await onSaved(result.conversation.id);
    } catch (cause) { setProblem(messageOf(cause)); }
    finally { setSaving(false); }
  };
  return <View style={styles.chat}>
    {value ? <View style={styles.chatToolbar}>
      <Text numberOfLines={1} style={[styles.rowTitle, styles.flex]}>{value.conversation.title}</Text>
      <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setDetails(!details)}><Text style={styles.hint}>Details</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.smallButton} onPress={onShare}><Text>Share</Text></Pressable>
    </View> : null}
    <ScrollView ref={scroll} contentContainerStyle={[styles.chatContent, !value && styles.chatEmpty]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (value && !details) scroll.current?.scrollToEnd({ animated: false }); }}>
      {loading ? <ActivityIndicator color={colors.accent} /> : value ? <>
        {details ? <View style={styles.detailCard}>
          <Provenance lineage={value.conversation.lineage} />
          <ClaimList title="Decisions" values={value.analysis.decisions.map((item) => item.text)} />
          <ClaimList title="Open questions" values={value.analysis.openQuestions.map((item) => item.text)} />
          <Text style={styles.hint}>Originally from {value.conversation.source.provider} · {value.conversation.messages.length} messages</Text>
        </View> : null}
        {value.conversation.messages.map((message) => <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
          <Text style={styles.messageRole}>{message.author || (message.role === "user" ? "You" : message.role === "assistant" ? value.conversation.source.provider : message.role)}</Text>
          <Text selectable style={styles.messageText}>{message.content}</Text>
        </View>)}
      </> : <View style={styles.welcome}>
        <Text style={styles.welcomeTitle}>What would you like to share?</Text>
        <Text style={styles.welcomeCopy}>A conversation worth keeping. An idea worth passing on.</Text>
        <Pressable accessibilityRole="button" style={styles.suggestion} onPress={onImport}><Text style={styles.rowTitle}>Import a conversation</Text><Text style={styles.hint}>Bring a chat or a shared link into Magnet →</Text></Pressable>
      </View>}
    </ScrollView>
    <View style={styles.composerArea}>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <View style={styles.composer}>
        <TextInput accessibilityLabel="Message" multiline textAlignVertical="top" style={styles.composerInput} value={draft} onChangeText={setDraft} editable={!saving && !loading} placeholder="Write a message…" placeholderTextColor={colors.subtle} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: saving || loading || !draft.trim() }} style={[styles.sendButton, (saving || loading || !draft.trim()) && styles.disabled]} disabled={saving || loading || !draft.trim()} onPress={() => void send()}>{saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.sendIcon}>↑</Text>}</Pressable>
      </View>
      <Text style={styles.composerHint}>Saved to this conversation. Share a link when you’re ready. AI replies aren’t generated here.</Text>
    </View>
  </View>;
}

/**
 * Where this conversation came from, when it did not start here.
 *
 * A locally authored conversation shows nothing: an empty provenance block on
 * every thread would train people to ignore the one that matters. An imported
 * one names the instance rather than only the id, because an id on its own is
 * not an address and tells a person nothing.
 */
function Provenance({ lineage }: { lineage?: Lineage }) {
  const { styles } = useTheme();
  if (!lineage?.originInstance && !lineage?.continuedBy && !lineage?.parentId) return null;
  return (
    <View style={styles.provenance}>
      <Text style={styles.detailLabel}>Where this came from</Text>
      {lineage.originInstance ? (
        <Text style={styles.meta}>Handed over by {lineage.originInstance}</Text>
      ) : null}
      {lineage.continuedBy ? (
        <Text style={styles.meta}>Continued in {lineage.continuedBy}</Text>
      ) : null}
      {lineage.importedAt ? (
        <Text style={styles.meta}>Arrived {new Date(lineage.importedAt).toLocaleString()}</Text>
      ) : null}
      {lineage.rootId ? (
        <Text style={styles.hint}>Chain root {lineage.rootId}</Text>
      ) : null}
    </View>
  );
}

function ImportView({ client, busy, setBusy, onImported, setError }: {
  client: MagnetClient;
  busy: string;
  setBusy: (value: string) => void;
  onImported: (conversation: ConversationSummary) => Promise<void>;
  setError: (value: string) => void;
}) {
  const { styles, colors } = useTheme();
  const [payload, setPayload] = useState("");
  const [tags, setTags] = useState("");
  const [choices, setChoices] = useState<ReturnType<typeof archiveChoices>>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<MagnetClient["previewText"]>> | null>(null);
  const changePayload = (text: string) => { setPayload(text); setPreview(null); setChoices(archiveChoices(text)); };
  const chooseFile = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,.txt,.md";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 100_000_000) { setError("This archive is over 100 MB. Export or paste just the conversation you want to transfer."); return; }
      void file.text().then(changePayload).catch(() => setError("Could not read this file. Try a JSON or text export."));
    };
    input.click();
  };

  const run = async () => {
    if (!payload.trim()) { setError("Paste a conversation first."); return; }
    setBusy("import");
    setError("");
    try {
      if (!preview) { setPreview(await client.previewText(payload.trim())); return; }
      const result = await client.importText(payload.trim(), "auto", tags.split(",").map((tag) => tag.trim()).filter(Boolean));
      const conversation = result.conversations[0];
      if (!conversation) throw new Error("The server did not return an imported conversation.");
      setPayload("");
      setTags("");
      await onImported(conversation);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy("");
    }
  };

  return (
    <View>
      <Text style={styles.pageTitle}>Bring a conversation</Text>
      <Text style={styles.hint}>From ChatGPT: paste the chat with “You said:” and “ChatGPT said:” labels, or choose conversations.json from your downloaded data export. Only the chat you select is uploaded. Shared ChatGPT URLs alone cannot be imported.</Text>
      {Platform.OS === "web" ? <Action label="Choose export or text file" onPress={chooseFile} secondary disabled={Boolean(busy)} /> : null}
      {choices.length ? <View><SectionTitle>Choose one conversation</SectionTitle>{choices.map((choice, index) => <Action key={index} label={choice.title} onPress={() => { setPayload(choice.payload); setChoices([]); setPreview(null); }} secondary />)}</View> : null}
      <Field label="Tags (optional)" value={tags} onChangeText={setTags} placeholder="research, launch" />
      <Text style={styles.fieldLabel}>Conversation or export</Text>
      <TextInput accessibilityLabel="Conversation or export" multiline textAlignVertical="top" style={styles.textarea} value={choices.length ? "Choose a conversation above before uploading this archive." : payload} editable={!choices.length && !busy} onChangeText={changePayload} placeholder="You said:\nHelp me plan…\nChatGPT said:\nHere is the plan…" placeholderTextColor={colors.subtle} />
      <Text style={styles.hint}>Text and message order are preserved. Attachments, hidden reasoning and platform memory are not transferred. Review the imported thread before sharing.</Text>
      {preview ? <View style={styles.provenance}>{preview.preview.map((item, index) => <Text key={index}>{item.title} · {item.provider} · {item.messages} messages</Text>)}{preview.warnings.map((warning, index) => <Text key={index} style={styles.hint}>{warning}</Text>)}</View> : null}
      <Action label={busy === "import" ? "Checking…" : preview ? "Save conversation →" : "Preview import"} onPress={run} disabled={Boolean(busy) || choices.length > 0 || !payload.trim()} />
      <View style={styles.divider} />
      <ReceiveLink client={client} onReceived={onImported} setError={setError} />
    </View>
  );
}

/**
 * Taking a handoff someone sent you.
 *
 * Two different things can happen with a link, and conflating them is how the
 * chain gets lost. Importing keeps a copy and records where it came from.
 * Continuing does that and adds your turn as a new conversation that says which
 * client carried the work forward. Editing an imported copy afterwards looks
 * the same on screen and leaves nothing saying the work moved on.
 *
 * Preview first, always. A share link is a bearer link: whoever holds it can
 * redeem it, and every redemption spends one of its uses. Showing what is
 * inside before committing means nobody burns a one-use link finding out.
 */
function ReceiveLink({ client, onReceived, setError }: {
  client: MagnetClient;
  onReceived: (conversation: ConversationSummary) => Promise<void>;
  setError: (value: string) => void;
}) {
  const { styles, colors } = useTheme();
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState("");
  const [role, setRole] = useState<"user" | "assistant">("user");
  const [reply, setReply] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [working, setWorking] = useState("");

  const look = async () => {
    if (!url.trim()) { setError("Paste the handoff link first."); return; }
    setWorking("preview");
    setError("");
    try {
      setPreview(await client.previewLink(url.trim()));
    } catch (cause) {
      setPreview(null);
      setError(messageOf(cause));
    } finally {
      setWorking("");
    }
  };

  const take = async (mode: "copy" | "continue") => {
    if (!preview || working) return;
    if (!url.trim()) { setError("Paste the handoff link first."); return; }
    if (mode === "continue" && !reply.trim()) { setError("Write the turn you are adding."); return; }
    if (mode === "continue" && !provider.trim()) { setError("Name the client you are continuing in."); return; }
    setWorking(mode);
    setError("");
    try {
      const result = mode === "copy"
        ? await client.importLink(url.trim())
        : await client.continueFromLink({ url: url.trim(), provider: provider.trim(), content: reply.trim(), role });
      setUrl("");
      setReply("");
      setPreview(null);
      await onReceived(result.conversation);
    } catch (cause) {
      // Deliberately leaves the link and the reply in place. A failed redemption
      // is often a link that expired or a relay that was asleep, and retyping
      // a paragraph to retry is the wrong tax for that.
      setError(messageOf(cause));
    } finally {
      setWorking("");
    }
  };

  return (
    <View>
      <Text style={styles.eyebrow}>Open a shared link</Text>
      <Field label="Handoff link" value={url} onChangeText={(value) => { setUrl(value); setPreview(null); }} editable={!working} autoCapitalize="none" placeholder="https://magnet.example.com/share/…" />
      <Action label={working === "preview" ? "Looking…" : "Preview link"} onPress={() => void look()} secondary disabled={Boolean(working)} />
      {preview ? (
        <View style={styles.provenance}>
          <Text style={styles.detailLabel}>{preview.preview.title}</Text>
          <Text style={styles.meta}>{preview.preview.provider} · {preview.preview.messages} MESSAGES</Text>
          <Text style={styles.meta}>From {preview.origin.instance}</Text>
          <Text style={styles.meta}>
            {preview.preview.usesRemaining} {preview.preview.usesRemaining === 1 ? "USE" : "USES"} LEFT · EXPIRES {new Date(preview.preview.expiresAt).toLocaleString()}
            {preview.preview.redact ? " · REDACTED" : ""}
          </Text>
          <Text style={styles.hint}>Looking is free. Importing or continuing spends one use.</Text>
          {preview.warnings.map((warning) => <Text key={warning} style={styles.hint}>{warning}</Text>)}
        </View>
      ) : null}
      <Field label="Continue in" value={provider} onChangeText={setProvider} autoCapitalize="none" placeholder="claude, gemini, chatgpt…" />
      <Text style={styles.fieldLabel}>Your turn (for continuing)</Text>
      <View style={styles.buttonRow}>
        <Action label={role === "user" ? "✓ MY MESSAGE" : "MY MESSAGE"} onPress={() => setRole("user")} secondary />
        <Action label={role === "assistant" ? "✓ MODEL RESPONSE" : "MODEL RESPONSE"} onPress={() => setRole("assistant")} secondary />
      </View>
      <TextInput multiline textAlignVertical="top" style={styles.textarea} value={reply} onChangeText={setReply} placeholder="What you are adding on top of their work…" placeholderTextColor={colors.subtle} />
      <Action label={working === "continue" ? "Continuing…" : "Continue it here →"} onPress={() => void take("continue")} disabled={Boolean(working) || !preview} />
      <Action label={working === "copy" ? "Importing…" : "Just keep a copy"} onPress={() => void take("copy")} secondary disabled={Boolean(working) || !preview} />
      <Text style={styles.hint}>Preview first, then choose one action. Receiving spends one use. Magnet saves the turn you enter; it does not call the named model.</Text>
    </View>
  );
}

function HandoffsView({ client, conversations, handoffs, selectedId, onSelect, refresh, setError, setNotice }: {
  client: MagnetClient;
  conversations: ConversationSummary[];
  handoffs: HandoffSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  refresh: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
}) {
  const { styles, colors } = useTheme();
  const [ttl, setTtl] = useState("60");
  const [uses, setUses] = useState("3");
  const [audience, setAudience] = useState("");
  const [redact, setRedact] = useState(true);
  const [issued, setIssued] = useState<IssuedHandoff | null>(null);
  const [context, setContext] = useState<{ text: string; messageCount: number } | null>(null);
  const [working, setWorking] = useState("");

  const chosen = conversations.find((item) => item.id === selectedId) ?? conversations[0];

  const prepareContext = async () => {
    if (!chosen) return;
    setWorking("packet"); setError("");
    try { setContext(await client.continuationText(chosen.id)); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setWorking(""); }
  };

  const create = async () => {
    if (!chosen) { setError("Import or select a conversation first."); return; }
    setWorking("handoff"); setError("");
    try {
      const result = await client.createHandoff(chosen.id, {
        ttlMinutes: Number(ttl) || 60,
        maxUses: Number(uses) || 3,
        audience: audience.trim() || undefined,
        redact,
      });
      setIssued({ ...result, shareUrl: readerUrl(result.shareUrl) });
      setNotice("Share link created.");
      await refresh();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setWorking(""); }
  };

  const copyContext = async () => {
    if (!context) return;
    try {
      if (Platform.OS === "web") { await navigator.clipboard.writeText(context.text); setNotice("Full text copied. Paste into a new Claude chat, then add your next question."); }
      else await Share.share({ message: context.text });
    } catch { setNotice("Select the full text below to copy it, or download the transcript."); }
  };

  const share = async (value: string) => {
    try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setNotice("Share link copied.");
      return;
    }
      if (Platform.OS === "web") {
        setNotice("Select and copy the link shown below, then paste it into Import on the other device.");
      } else await Share.share({ message: value });
    } catch {
      setNotice("Select and copy the link shown below, then paste it into Import on the other device.");
    }
  };

  const revoke = async (id: string) => {
    setWorking(id); setError("");
    try { await client.revokeHandoff(id); setNotice("Share link revoked."); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setWorking(""); }
  };

  return (
    <View>
      <Text style={styles.pageTitle}>Share a conversation</Text>
      <SectionTitle>1 · choose the thread</SectionTitle>
      {conversations.map((item, index) => (
        <ConversationRow key={item.id} item={item} index={index + 1} selected={chosen?.id === item.id} onPress={() => { onSelect(item.id); setIssued(null); setContext(null); }} />
      ))}
      {!chosen ? <Empty>Import a conversation before creating a handoff.</Empty> : null}
      {chosen ? (
        <>
          <SectionTitle>Continue in Claude or another AI</SectionTitle>
          <Text style={styles.hint}>Copy or download the full saved text, then paste or upload it into a new chat. Nothing is summarized or cut to fit. The destination’s context limit still applies. Review private content before sending; this export is not redacted.</Text>
          <Action label={working === "packet" ? "Preparing…" : "Prepare full conversation"} onPress={prepareContext} secondary disabled={Boolean(working)} />
          {context ? <View style={styles.packet}>
            <Text style={styles.meta}>{context.messageCount} messages · Full saved text</Text>
            <Action label="Copy for Claude or another AI" onPress={copyContext} />
            {Platform.OS === "web" ? <Action label="Download transcript (.txt)" onPress={() => downloadText(context.text, "magnet-context.txt")} secondary /> : null}
            <Action label="Open Claude" onPress={() => { void Linking.openURL("https://claude.ai/new").catch(() => setError("Open claude.ai in your browser and paste the copied text.")); }} secondary />
            <Text style={styles.hint}>Opening Claude does not send your conversation. Paste the text or upload the file there.</Text>
            <TextInput accessibilityLabel="Full continuation text" multiline editable={false} style={styles.textarea} value={context.text} />
          </View> : null}
          <SectionTitle>Send to another person</SectionTitle>
          <Text style={styles.hint}>The recipient can read the conversation and take it to their own AI without an account. Anyone holding the link can open it; the recipient label is not an access restriction. Revoking stops future opens, not copies already saved.</Text>
          <Field label="Recipient label (optional)" value={audience} onChangeText={setAudience} placeholder="Alex · Project planning" />
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}><Field label="Expires in minutes" value={ttl} onChangeText={setTtl} keyboardType="number-pad" /></View>
            <View style={styles.fieldHalf}><Field label="Max uses" value={uses} onChangeText={setUses} keyboardType="number-pad" /></View>
          </View>
          <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchTitle}>Redact sensitive text</Text><Text style={styles.hint}>Filter common emails and credentials. Review the content before sharing.</Text></View><Switch value={redact} onValueChange={setRedact} trackColor={{ false: colors.strong, true: colors.accent }} /></View>
          <Action label={working === "handoff" ? "Creating…" : "Create share link →"} onPress={create} disabled={Boolean(working)} />
          {issued ? <View style={styles.successCard}><Text style={styles.detailLabel}>EXPIRING Handoff link</Text><Text selectable style={styles.link}>{issued.shareUrl}</Text><Action label="Copy or share link" onPress={() => void share(issued.shareUrl)} secondary /></View> : null}
        </>
      ) : null}
      <SectionTitle>Issued handoffs</SectionTitle>
      {handoffs.map((handoff) => (
        <View key={handoff.id} style={styles.handoffRow}>
          <View style={styles.flex}><Text style={styles.rowTitle}>{handoff.audience || "PRIVATE LINK"}</Text><Text style={styles.meta}>{handoff.active ? "ACTIVE" : handoff.revokedAt ? "RevokeD" : "EXPIRED OR SPENT"} · {handoff.uses}/{handoff.maxUses} USES · {shortDate(handoff.expiresAt)}</Text></View>
          {handoff.active ? <Pressable style={styles.revokeButton} onPress={() => void revoke(handoff.id)} disabled={working === handoff.id}><Text style={styles.revokeText}>Revoke</Text></Pressable> : null}
        </View>
      ))}
      {!handoffs.length ? <Empty>No shared links yet.</Empty> : null}
    </View>
  );
}

function SettingsView({ connection, stats, connectors, client, disconnect, setError, setNotice }: {
  connection: StoredConnection;
  stats: Stats | null;
  connectors: ConnectorStatus[];
  client: MagnetClient;
  disconnect: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
}) {
  const { styles } = useTheme();
  const [testing, setTesting] = useState(false);
  const retest = async () => {
    setTesting(true); setError("");
    try { await client.checkConnection(); setNotice("Connection verified."); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setTesting(false); }
  };
  return (
    <View>
      <Text style={styles.pageTitle}>Settings</Text>
      <View style={styles.detailCard}><Text style={styles.detailLabel}>Server</Text><Text selectable style={styles.link}>{connection.baseUrl}</Text><Text style={styles.meta}>{stats ? "CONNECTED" : "STATUS UNKNOWN"}</Text></View>
      <Action label={testing ? "Testing…" : "Retest connection"} onPress={retest} secondary disabled={testing} />
      <SectionTitle>Connected sources</SectionTitle>
      {connectors.filter((connector) => connector.configured).map((connector) => (
        <View key={connector.id} style={styles.connectorRow}>
          <View style={[styles.dot, connector.configured && styles.dotOn]} />
          <View style={styles.flex}><Text style={styles.rowTitle}>{connector.label}</Text><Text style={styles.meta}>{connector.detail}</Text></View>
        </View>
      ))}
      <View style={styles.divider} />
      <Pressable style={styles.disconnectButton} onPress={() => void disconnect()}><Text style={styles.disconnectText}>Disconnect this device</Text></Pressable>
      <Text style={styles.hint}>Disconnecting clears the saved server URL and API key from this device.</Text>
    </View>
  );
}

function ConversationRow({ item, selected, onPress }: { item: ConversationSummary; index: number; selected?: boolean; onPress: () => void }) {
  const { styles } = useTheme();
  return (
    <Pressable style={[styles.conversationRow, selected && styles.conversationSelected]} onPress={onPress}>
      <View style={styles.sourceBadge}><Text style={styles.sourceText}>{item.source.provider.slice(0, 2).toUpperCase()}</Text></View>
      <View style={styles.flex}><Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text><Text style={styles.meta}>{item.messageCount} MESSAGES · {shortDate(item.updatedAt)}</Text></View>
      <Text style={styles.arrow}>→</Text>
    </Pressable>
  );
}

function Field(props: ComponentProps<typeof TextInput> & { label: string }) {
  const { styles, colors } = useTheme();
  const { label, style, ...inputProps } = props;
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.subtle} style={[styles.input, style]} {...inputProps} /></View>;
}

function Action({ label, onPress, secondary, disabled }: { label: string; onPress: () => void | Promise<void>; secondary?: boolean; disabled?: boolean }) {
  const { styles } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} style={[styles.action, secondary && styles.actionSecondary, disabled && styles.disabled]} onPress={() => void onPress()} disabled={disabled}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text></Pressable>;
}

function Notice({ children, tone }: { children: ReactNode; tone?: "error" }) {
  const { styles } = useTheme();
  return <View style={[styles.notice, tone === "error" && styles.errorNotice]}><Text style={styles.noticeText}>{children}</Text></View>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  const { styles } = useTheme(); return <Text style={styles.sectionTitle}>{children}</Text>; }
function Empty({ children }: { children: ReactNode }) {
  const { styles } = useTheme(); return <Text style={styles.empty}>{children}</Text>; }
function ClaimList({ title, values }: { title: string; values: string[] }) {
  const { styles } = useTheme();
  if (!values.length) return null;
  return <View><SectionTitle>{title}</SectionTitle>{values.slice(0, 5).map((value, index) => <Text key={`${title}-${index}`} style={styles.claim}>• {value}</Text>)}</View>;
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}


function Text({ style, ...props }: ComponentProps<typeof NativeText>) {
  const { colors } = useTheme();
  return <NativeText {...props} style={[{ color: colors.text }, style]} />;
}
