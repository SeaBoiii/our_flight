import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Monogram selection · Aleem & Nurulain',
  description: 'Private monogram comparison for Aleem and Nurulain.',
};

const options = [
  {
    id: 'a-and-a',
    label: 'A & A',
    note: 'Symmetrical and ceremonial',
    src: '/brand-options/monogram-a-and-a.png',
  },
  {
    id: 'a-and-n',
    label: 'A & N',
    note: 'Personal and immediately recognisable',
    src: '/brand-options/monogram-a-and-n.png',
  },
] as const;

export default function BrandOptionsPage() {
  return (
    <main className="brand-page">
      <header className="brand-heading">
        <p className="micro-label">Aleem &amp; Nurulain · Monogram selection</p>
        <h1>Which mark feels like yours?</h1>
        <p>Both transparent marks use the same cloud-and-flight visual language. Compare them on a light and dark boarding pass below.</p>
      </header>

      <div className="brand-options">
        {options.map((option) => (
          <section className="brand-option" aria-labelledby={`${option.id}-title`} key={option.id}>
            <div className="brand-option-title">
              <h2 id={`${option.id}-title`}>{option.label}</h2>
              <p>{option.note}</p>
            </div>
            <div className="brand-ticket brand-ticket-light">
              <span>OUR FLIGHT · AN2208</span>
              <Image src={option.src} alt={`${option.label} monogram on an ivory ticket`} width={768} height={512} />
              <small>Wedding keepsake · Not valid for travel</small>
            </div>
            <div className="brand-ticket brand-ticket-dark">
              <span>21—22 AUGUST 2027 · SIN</span>
              <Image src={option.src} alt={`${option.label} monogram on a midnight teal ticket`} width={768} height={512} />
              <small>Aleem &amp; Nurulain · Crowne Plaza Changi Airport</small>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
