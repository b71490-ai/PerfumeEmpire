import Link from 'next/link'

export const metadata = {
  title: 'عن المتجر | عطور الإمبراطورية',
  description: 'تعرف على قصة متجر عطور الإمبراطورية ورسالتنا في تقديم عطور أصلية وتجربة شراء راقية.'
}

export default function AboutPage() {
  return (
    <main className="about-store-page">
      <section className="about-hero">
        <span className="about-badge">من نحن</span>
        <h1>عن متجر عطور الإمبراطورية</h1>
        <p>
          نؤمن أن العطر ليس مجرد منتج، بل هو توقيع شخصي يعبّر عن الذوق والهوية.
          لذلك نعمل على تقديم منتجات أصلية مختارة بعناية، مع خدمة راقية وتجربة شراء سهلة.
        </p>
      </section>

      <section className="about-grid">
        <article className="about-card">
          <h2>رؤيتنا</h2>
          <p>أن نكون الوجهة الأولى لعشاق العطور الفاخرة في المنطقة من خلال الجودة والثقة والابتكار.</p>
        </article>
        <article className="about-card">
          <h2>رسالتنا</h2>
          <p>توفير تجربة تسوق عطرية مميزة تجمع بين الأصالة والسعر العادل والتوصيل السريع.</p>
        </article>
        <article className="about-card">
          <h2>قيمنا</h2>
          <p>الشفافية، الاهتمام بالتفاصيل، رضا العميل، والاستمرارية في تحسين التجربة.</p>
        </article>
      </section>

      <section className="about-cta">
        <h3>جاهز لاكتشاف عطرك القادم؟</h3>
        <div className="about-cta-actions">
          <Link href="/shop" className="about-btn about-btn-primary">تصفح المتجر</Link>
          <Link href="/contact" className="about-btn about-btn-secondary">تواصل معنا</Link>
        </div>
      </section>
    </main>
  )
}
