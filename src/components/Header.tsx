export function Header() {

  const baseUrl = import.meta.env.BASE_URL.endsWith('/') 
    ? import.meta.env.BASE_URL 
    : `${import.meta.env.BASE_URL}/`;

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="group-name" href={baseUrl}>
          World360-AI
        </a>
        
        <a className="nav-link" href={`${baseUrl}about.html`}>
          About
        </a>
        <a className="nav-link" href={`${baseUrl}highlights.html`}>
          Highlights
        </a>
        <a className="nav-link" href={`${baseUrl}research.html`}>
          Research
        </a>
        <a className="nav-link" href={`${baseUrl}projects.html`}>
          Projects
        </a>
        <a className="nav-link" href={`${baseUrl}events.html`}>
          Events
        </a>
        <a className="nav-link" href={`${baseUrl}media.html`}>
          Media
        </a>
        <a className="nav-link" href={`${baseUrl}references.html`}>
          References
        </a>
        <a className="nav-link internal" href={`${baseUrl}internal.html`}>
          Internal
        </a>
      </nav>
    </header>
  )
}