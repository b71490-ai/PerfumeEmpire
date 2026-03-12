const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'

export default function Head() {
  const canonical = `${siteUrl}/cart`
  return (
    <>
      <title>سلة التسوق — عطور الإمبراطورية</title>
      <meta name="description" content="راجع محتويات سلة التسوق وأكمل طلبك بسهولة. تحقق من الأسعار والشحن والخصومات قبل الدفع." />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content="سلة التسوق — عطور الإمبراطورية" />
      <meta property="og:description" content="راجع محتويات سلة التسوق وأكمل طلبك بسهولة. تحقق من الأسعار والشحن والخصومات قبل الدفع." />
      <meta property="og:url" content={canonical} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="سلة التسوق — عطور الإمبراطورية" />
      <meta name="twitter:description" content="راجع محتويات سلة التسوق وأكمل طلبك بسهولة. تحقق من الأسعار والشحن والخصومات قبل الدفع." />
    </>
  )
}
