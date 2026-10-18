
import "./style.css";
import { marked } from "marked";
import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

const $ = (selector) => document.querySelector(selector);
const STORE = "nova-assistant-v1";

const defaults = {
  provider: "gemini",
  geminiKey: "",
  openaiKey: "",
  model: "gemini-2.5-flash",
  theme: "dark",
  language: "en",
  webSearch: false,
  personality: "You are Nova, a helpful, honest personal AI assistant.",
  conversations: [],
  activeId: null
};

let state;
try {
  state = { ...defaults, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
} catch {
  state = { ...defaults };
}

let busy = false;
let attachedFile = null;

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function currentChat() {
  return state.conversations.find((chat) => chat.id === state.activeId);
}

function newChat() {
  const chat = {
    id: crypto.randomUUID(),
    title: "New conversation",
    messages: []
  };
  state.conversations.unshift(chat);
  state.activeId = chat.id;
  save();
  render();
}

function ensureChat() {
  if (!currentChat()) newChat();
  return currentChat();
}

function renderMessages() {
  const chat = currentChat();
  if (!chat || !chat.messages.length) {
    return `
      <section class="welcome">
        <div class="orb"></div>
        <p class="eyebrow">YOUR PERSONAL AI</p>
        <h1>What's on<br><span>your mind?</span></h1>
        <p class="muted">Ask a question, study something new, or work on an idea.</p>
        <div class="suggestions">
          <button data-prompt="Explain a difficult topic simply">✦ Explain a topic</button>
          <button data-prompt="Help me make a study plan">⌁ Study plan</button>
          <button data-prompt="Give me a creative project idea">◈ Project ideas</button>
          <button data-prompt="Teach me something interesting">✧ Teach me something</button>
        </div>
      </section>`;
  }

  return `<div class="messages">${chat.messages.map((message, index) => `
    <article class="message ${message.role === "user" ? "user-message" : "ai-message"}">
      <div class="message-avatar">${message.role === "user" ? "Y" : "N"}</div>
      <div class="message-content">
        <div class="message-label">${message.role === "user" ? "YOU" : "NOVA"}</div>
        <div class="markdown">${message.role === "user"
          ? escapeHTML(message.content).replace(/\n/g, "<br>")
          : marked.parse(message.content || "")}</div>
        ${message.role === "assistant" ? `
          <div class="message-actions">
            <button data-copy="${index}">Copy</button>
            <button data-speak="${index}">Read aloud</button>
          </div>` : ""}
      </div>
    </article>`).join("")}</div>`;
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.language;
  const chat = currentChat();

  $("#app").innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><div class="brand-icon">N</div><div><b>NOVA</b><small>PERSONAL INTELLIGENCE</small></div></div>
        <button class="new-chat" id="new-chat">＋ <span>New conversation</span></button>
        <div class="side-label">YOUR HISTORY</div>
        <div class="history">
          ${state.conversations.map((item) => `
            <button class="history-item ${item.id === state.activeId ? "selected" : ""}" data-chat="${item.id}">
              <span>◌</span><span class="history-title">${escapeHTML(item.title)}</span>
              <span class="delete-chat" data-delete="${item.id}" title="Delete">×</span>
            </button>`).join("") || `<p class="muted empty-history">Your conversations will appear here.</p>`}
        </div>
        <div class="sidebar-bottom">
          <button id="export-chat">⇩ Export conversation</button>
          <button id="settings-toggle">⚙ Settings</button>
          <div class="profile"><div class="profile-icon">N</div><div><b>Nova Assistant</b><small>Personal workspace</small></div><span class="online-dot"></span></div>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <button class="icon-button mobile-menu" id="mobile-menu" aria-label="Open menu">☰</button>
          <div class="status"><span class="online-dot"></span> NOVA IS READY</div>
          <div class="top-actions">
            <button class="icon-button" id="theme-toggle" title="Toggle theme">◐</button>
            <button class="icon-button" id="top-settings" title="Settings">⚙</button>
          </div>
        </header>

        <section class="workspace">
          ${renderMessages()}
        </section>

        <div class="composer-wrap">
          <div class="attachment" id="attachment"></div>
          <form class="composer" id="chat-form">
            <input type="file" id="file-input" accept=".pdf,.txt,.md,.json,.csv,image/*" hidden />
            <button type="button" class="composer-tool" id="attach" title="Attach file">＋</button>
            <textarea id="prompt" rows="1" placeholder="Message Nova..." aria-label="Message Nova"></textarea>
            <button type="button" class="composer-tool" id="voice" title="Voice input">♩</button>
            <button type="submit" class="send-button" id="send" aria-label="Send message">↑</button>
          </form>
          <div class="composer-foot"><span>AI can make mistakes. Check important information.</span><span>POWERED BY YOUR SELECTED PROVIDER</span></div>
        </div>
      </main>

      <aside class="settings-panel ${window.novaSettingsOpen ? "open" : ""}" id="settings">
        <div class="settings-heading"><div><p class="eyebrow">PERSONALIZE</p><h2>Settings</h2></div><button class="icon-button" id="close-settings">×</button></div>
        <label>AI provider<select id="provider"><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option></select></label>
        <label>Model<select id="model"></select></label>
        <label id="key-label">API key<input id="api-key" type="password" placeholder="Paste your API key" autocomplete="off" /></label>
        <p class="hint">Your key is stored in this browser on this device. Never share it or commit it to GitHub. API usage may cost money.</p>
        <label>Assistant personality<textarea id="personality" rows="4" placeholder="How should Nova behave?"></textarea></label>
        <label>Language<select id="language"><option value="en">English</option><option value="sr">Srpski</option></select></label>
        <label class="switch-row"><span>Web search preference<small>Preference only; live web search is not connected yet.</small></span><input id="web-search" type="checkbox" /></label>
        <button class="primary-button" id="save-settings">Save settings</button>
        <button class="secondary-button" id="clear-history">Clear all conversations</button>
        <p class="hint">Nova's basic interface and saved history work locally. AI replies require an API key and internet access.</p>
      </aside>
      <div class="overlay" id="overlay"></div>
    </div>`;

  $("#provider").value = state.provider;
  $("#language").value = state.language;
  $("#personality").value = state.personality;
  $("#web-search").checked = state.webSearch;
  $("#api-key").value = state.provider === "gemini" ? state.geminiKey : state.openaiKey;

  const models = state.provider === "gemini"
    ? [
        ["gemini-2.5-flash", "Gemini 2.5 Flash"],
        ["gemini-2.5-pro", "Gemini 2.5 Pro"]
      ]
    : [
        ["gpt-4.1-mini", "GPT-4.1 mini"],
        ["gpt-4.1", "GPT-4.1"]
      ];
  $("#model").innerHTML = models.map(([value, label]) =>
    `<option value="${value}">${label}</option>`).join("");
  if (models.some(([value]) => value === state.model)) {
    $("#model").value = state.model;
  } else {
    state.model = models[0][0];
    $("#model").value = state.model;
  }

  $("#attachment").innerHTML = attachedFile
    ? `<span>📎 ${escapeHTML(attachedFile.name)}</span><button id="remove-file" type="button">×</button>`
    : "";

  bindEvents();
}

function openSettings() {
  window.novaSettingsOpen = true;
  $("#settings")?.classList.add("open");
  $("#overlay")?.classList.add("visible");
}

function closeSettings() {
  window.novaSettingsOpen = false;
  $("#settings")?.classList.remove("open");
  $("#overlay")?.classList.remove("visible");
}

function bindEvents() {
  $("#new-chat").onclick = newChat;
  $("#settings-toggle").onclick = openSettings;
  $("#top-settings").onclick = openSettings;
  $("#close-settings").onclick = closeSettings;
  $("#overlay").onclick = () => {
    closeSettings();
    $("#sidebar")?.classList.remove("mobile-open");
  };
  $("#mobile-menu").onclick = () => $("#sidebar").classList.toggle("mobile-open");

  $("#theme-toggle").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    save();
    render();
  };

  document.querySelectorAll("[data-chat]").forEach((button) => {
    button.onclick = (event) => {
      if (event.target.closest("[data-delete]")) return;
      state.activeId = button.dataset.chat;
      save();
      render();
    };
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      state.conversations = state.conversations.filter((c) => c.id !== button.dataset.delete);
      if (state.activeId === button.dataset.delete) state.activeId = state.conversations[0]?.id || null;
      save();
      render();
    };
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.onclick = () => {
      $("#prompt").value = button.dataset.prompt;
      $("#prompt").focus();
    };
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.onclick = async () => {
      const message = currentChat()?.messages[Number(button.dataset.copy)];
      if (message) await navigator.clipboard.writeText(message.content);
      button.textContent = "Copied!";
    };
  });

  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.onclick = () => {
      const message = currentChat()?.messages[Number(button.dataset.speak)];
      if (!message || !("speechSynthesis" in window)) {
        alert("Speech output is not supported in this browser.");
        return;
      }
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.lang = state.language === "sr" ? "sr-RS" : "en-US";
      speechSynthesis.speak(utterance);
    };
  });

  $("#provider").onchange = () => {
    const provider = $("#provider").value;
    $("#api-key").value = provider === "gemini" ? state.geminiKey : state.openaiKey;
  };

  $("#save-settings").onclick = () => {
    state.provider = $("#provider").value;
    state.model = $("#model").value;
    state.language = $("#language").value;
    state.personality = $("#personality").value.trim() || defaults.personality;
    state.webSearch = $("#web-search").checked;
    if (state.provider === "gemini") state.geminiKey = $("#api-key").value.trim();
    else state.openaiKey = $("#api-key").value.trim();
    save();
    closeSettings();
    render();
  };

  $("#clear-history").onclick = () => {
    if (!confirm("Delete all saved conversations? This cannot be undone.")) return;
    state.conversations = [];
    state.activeId = null;
    save();
    render();
  };

  $("#export-chat").onclick = () => {
    const chat = currentChat();
    if (!chat) return alert("There is no active conversation to export.");
    const text = chat.messages.map((m) =>
      `${m.role === "user" ? "You" : "Nova"}:\n${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chat.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "nova-chat"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  $("#attach").onclick = () => $("#file-input").click();
  $("#file-input").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith("image/")) {
        attachedFile = { name: file.name, type: "image", data: await fileToBase64(file), mime: file.type };
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        let text = "";
        for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 40); pageNo++) {
          const page = await pdf.getPage(pageNo);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str || "").join(" ") + "\n";
        }
        attachedFile = { name: file.name, type: "text", data: text.slice(0, 50000) };
      } else {
        attachedFile = { name: file.name, type: "text", data: (await file.text()).slice(0, 50000) };
      }
      $("#attachment").innerHTML = `<span>📎 ${escapeHTML(file.name)}</span><button id="remove-file" type="button">×</button>`;
      $("#remove-file").onclick = () => { attachedFile = null; $("#attachment").innerHTML = ""; };
    } catch (error) {
      alert("Could not read this file: " + error.message);
    }
    event.target.value = "";
  };

  $("#voice").onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return alert("Speech recognition is not supported here. Try a supported Android browser.");
    const recognition = new Recognition();
    recognition.lang = state.language === "sr" ? "sr-RS" : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      $("#prompt").value += event.results[0][0].transcript;
      $("#prompt").focus();
    };
    recognition.onerror = () => alert("Voice input failed. Check microphone permission and try again.");
    recognition.start();
  };

  $("#chat-form").onsubmit = async (event) => {
    event.preventDefault();
    const text = $("#prompt").value.trim();
    if ((!text && !attachedFile) || busy) return;
    await sendMessage(text || "Please analyze the attached file.");
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function askGemini(messages, imageAttachment) {
  if (!state.geminiKey) throw new Error("Add your Gemini API key in Settings first.");
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));
  if (imageAttachment) {
    contents.push({
      role: "user",
      parts: [
        { text: "Analyze this image. The user's question is in the preceding message." },
        { inline_data: { mime_type: imageAttachment.mime, data: imageAttachment.data } }
      ]
    });
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(state.model)}:generateContent?key=${encodeURIComponent(state.geminiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: state.personality }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini error ${response.status}`);
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "I couldn't generate a response.";
}

async function askOpenAI(messages, imageAttachment) {
  if (!state.openaiKey) throw new Error("Add your OpenAI API key in Settings first.");
  const input = messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content
  }));
  if (imageAttachment) {
    const last = input[input.length - 1];
    last.content = [
      { type: "input_text", text: last.content },
      { type: "input_image", image_url: `data:${imageAttachment.mime};base64,${imageAttachment.data}` }
    ];
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.openaiKey}`
    },
    body: JSON.stringify({
      model: state.model,
      instructions: state.personality,
      input
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `OpenAI error ${response.status}`);
  return data.output?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text).join("\n") || "I couldn't generate a response.";
}

async function sendMessage(text) {
  const chat = ensureChat();
  const prompt = text;
  const file = attachedFile;
  attachedFile = null;
  chat.messages.push({ role: "user", content: prompt + (file ? `\n\n[Attached file: ${file.name}]${file.type === "text" ? `\n${file.data}` : ""}` : "") });
  if (chat.messages.length === 1) chat.title = prompt.slice(0, 36) || file?.name || "New conversation";
  save();
  busy = true;
  render();
  $(".workspace").innerHTML += `<div class="typing"><span></span><span></span><span></span> Nova is thinking…</div>`;

  try {
    const history = chat.messages.map((message) => ({
      role: message.role,
      content: message.content
    }));
    const image = file?.type === "image" ? file : null;
    const answer = state.provider === "gemini"
      ? await askGemini(history, image)
      : await askOpenAI(history, image);
    chat.messages.push({ role: "assistant", content: answer });
  } catch (error) {
    chat.messages.push({
      role: "assistant",
      content: `**I couldn't complete that request.**\n\n${error.message}\n\nOpen Settings to check your provider, model, and API key.`
    });
  } finally {
    busy = false;
    save();
    render();
    $(".workspace").scrollTop = $(".workspace").scrollHeight;
  }
}

if (!state.activeId || !currentChat()) {
  if (state.conversations.length) state.activeId = state.conversations[0].id;
}
render();
