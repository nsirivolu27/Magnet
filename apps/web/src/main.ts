import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (root) root.innerHTML = `
  <header class="nav shell">
    <a class="brand" href="/">Magnet</a>
    <nav class="nav-links"><a href="#how">How it works</a><a href="https://github.com/nsirivolu27/Magnet">GitHub</a></nav>
    <a class="button primary" href="/mobile/">Open Magnet ↗</a>
  </header>
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Your conversations, together</p>
      <h1>Good ideas<br>deserve company.</h1>
      <p class="hero-text">Keep a conversation. Add your perspective. Share it with someone who can take it further.</p>
      <div class="hero-actions"><a class="button primary" href="/mobile/">Start a conversation</a><a class="button secondary" href="#how">See how it works</a></div>
      <p class="hint">Bring chats from ChatGPT, Claude, Gemini, or a plain-text transcript.</p>
    </section>
    <section id="how" class="section">
      <h2>A little less starting over.</h2>
      <div class="capability-grid">
        <article class="card"><span class="eyebrow">01</span><h3>Bring it in</h3><p>Paste a conversation or open a link someone shared. Keep the original messages together.</p></article>
        <article class="card"><span class="eyebrow">02</span><h3>Make it yours</h3><p>Add a message, search your history, and return to the ideas you want to keep.</p></article>
        <article class="card"><span class="eyebrow">03</span><h3>Pass it on</h3><p>Share a link with an expiration and use limit. Someone else can keep a copy or continue the thread.</p></article>
      </div>
    </section>
    <section class="section privacy"><h2>Know what you're sharing.</h2><p>Magnet currently stores and shares text conversations. It doesn't generate AI replies. The current version is not end-to-end encrypted, and anyone with a valid share link can use it.</p><a href="https://github.com/nsirivolu27/Magnet#privacy-and-current-limits">Read the current limits →</a></section>
  </main>
  <footer class="footer shell"><a class="brand" href="/">Magnet</a><span>Keep the conversation. Share what matters.</span><a href="/console.html">Advanced console</a></footer>
`;
