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
        
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/about/`}>
          About
        </a>
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/highlights/`}>
          Highlights
        </a>
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/research/`}>
          Research
        </a>
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/projects/`}>
          Projects
        </a>
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/events/`}>
          Events
        </a>
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/media/`}>
          Media
        </a>
        <a className="nav-link" href={`https://visgraflab.impa.br/world360-ai/wp/references/`}>
          References
        </a>
        <a className="nav-link internal" href={`https://visgraflab.impa.br/world360-ai/wp/internal/`}>
          Internal
        </a>
      </nav>
    </header>
  )
}