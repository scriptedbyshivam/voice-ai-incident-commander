import Link from 'next/link';

const footerColumns = [
  {
    title: 'Contact',
    links: [
      { label: 'Contact Us', href: '#support' },
      { label: 'Report an Issue', href: '/incidents/new' },
    ],
    extra: 'Built for on-call teams everywhere.',
  },
  {
    title: 'Product',
    links: [
      { label: 'Voice Bridge', href: '#features' },
      { label: 'AI Analysis', href: '#features' },
      { label: 'Timeline', href: '#features' },
      { label: 'Approvals', href: '#features' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
    ],
  },
  {
    title: 'Get Started',
    links: [
      { label: 'Open Dashboard', href: '/incidents' },
      { label: 'New Incident', href: '/incidents/new' },
      { label: 'Documentation', href: '#' },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="mt-24 bg-[#111111] rounded-t-[2rem] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-white font-semibold mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {col.extra && (
                <p className="text-xs text-white/40 mt-4 leading-relaxed">{col.extra}</p>
              )}
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <span className="text-[#33d1ff] font-semibold lowercase">commander</span>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="#" className="hover:text-white/70">Terms of Service</Link>
            <Link href="#" className="hover:text-white/70">Privacy Policy</Link>
            <Link href="#" className="hover:text-white/70">Acceptable Use</Link>
          </div>
          <span>Powered by Agora · Next.js · OpenAI</span>
        </div>
      </div>
    </footer>
  );
}
