'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchStoreSettings, submitContactMessage } from '@/lib/api'
import { digitsOnly, toEnglishDigits } from '@/lib/intl'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [storeSettings, setStoreSettings] = useState({
    contactPhone: '+966 50 123 4567',
    contactEmail: 'info@perfumeempire.com',
    contactWhatsapp: '+966 50 123 4567',
    contactInstagram: '@perfume_empire',
    contactAddress: 'الرياض، المملكة العربية السعودية',
    businessHours: 'السبت - الخميس: 9 صباحاً - 10 مساءً'
  })

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchStoreSettings()
        if (data) {
          setStoreSettings({
            contactPhone: data.contactPhone || '+966 50 123 4567',
            contactEmail: data.contactEmail || 'info@perfumeempire.com',
            contactWhatsapp: data.contactWhatsapp || '+966 50 123 4567',
            contactInstagram: data.contactInstagram || '@perfume_empire',
            contactAddress: data.contactAddress || 'الرياض، المملكة العربية السعودية',
            businessHours: data.businessHours || 'السبت - الخميس: 9 صباحاً - 10 مساءً'
          })
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  const handleChange = (e) => {
    const nextValue = e.target.name === 'phone' ? toEnglishDigits(e.target.value) : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: nextValue
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitContactMessage(formData)
      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
      setTimeout(() => {
        setSubmitted(false)
      }, 3000)
    } catch (error) {
      setSubmitError('تعذر إرسال الرسالة الآن، حاول مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  const contactInfo = [
    {
      icon: '📞',
      title: 'الهاتف',
      detail: storeSettings.contactPhone
    },
    {
      icon: '📧',
      title: 'البريد الإلكتروني',
      detail: storeSettings.contactEmail
    },
    {
      icon: '📍',
      title: 'العنوان',
      detail: storeSettings.contactAddress
    },
    {
      icon: '⏰',
      title: 'أوقات العمل',
      detail: storeSettings.businessHours
    }
  ]

  const socialLinks = [
    {
      icon: '📱',
      name: 'واتساب',
      url: `https://wa.me/${digitsOnly(storeSettings.contactWhatsapp)}`
    },
    {
      icon: '📷',
      name: 'انستغرام',
      url: `https://instagram.com/${String(storeSettings.contactInstagram || '').replace(/^@/, '')}`
    },
    {
      icon: '📧',
      name: 'البريد الإلكتروني',
      url: `mailto:${storeSettings.contactEmail || ''}`
    },
    {
      icon: '📞',
      name: 'اتصال هاتفي',
      url: `tel:${digitsOnly(storeSettings.contactPhone)}`
    }
  ]

  return (
    <main className="contact-page">
      {/* Header */}
      <div className="contact-header">
        <Link href="/" className="btn-back">
          <svg className="svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>الرئيسية</span>
        </Link>
      </div>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="contact-hero-content">
          <div className="hero-badge">💬 تواصل معنا</div>
          <h1 className="contact-hero-title">نحن هنا لمساعدتك</h1>
          <p className="contact-hero-description">
            فريقنا متاح دائماً للإجابة على استفساراتك وتقديم أفضل خدمة لك
          </p>
        </div>
      </section>

      <div className="contact-container">
        <section className="contact-quick-actions">
          {storeSettings.contactWhatsapp && (
            <a
              href={`https://wa.me/${digitsOnly(storeSettings.contactWhatsapp)}`}
              target="_blank"
              rel="noreferrer"
              className="contact-quick-action"
            >
              <span className="quick-action-icon">💬</span>
              <span>واتساب</span>
            </a>
          )}
          {storeSettings.contactPhone && (
            <a
              href={`tel:${digitsOnly(storeSettings.contactPhone)}`}
              className="contact-quick-action"
            >
              <span className="quick-action-icon">☎️</span>
              <span>اتصال سريع</span>
            </a>
          )}
        </section>

        {/* Contact Cards */}
        <section className="contact-info-section">
          <div className="contact-info-grid">
            {contactInfo.map((info, index) => (
              <div 
                key={index} 
                className={`contact-info-card contact-card-delay-${index + 1}`}
              >
                <div className={`contact-info-icon contact-icon-tone-${index + 1}`}>
                  {info.icon}
                </div>
                <h3 className="contact-info-title">{info.title}</h3>
                <p className="contact-info-detail">{info.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content */}
        <div className="contact-main-content">
          {/* Contact Form */}
          <section className="contact-form-section">
            <div className="form-header">
              <h2 className="form-title">📨 أرسل لنا رسالة</h2>
              <p className="form-description">سنرد عليك في أقرب وقت ممكن</p>
            </div>

            {submitted && (
              <div className="success-message">
                <span className="success-icon">✅</span>
                <span>شكراً لتواصلك معنا! سنرد عليك قريباً</span>
              </div>
            )}

            {submitError && (
              <div className="error-message contact-submit-error">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">الاسم الكامل *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="أدخل اسمك"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">رقم الهاتف *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+966 50 123 4567"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">البريد الإلكتروني *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="example@email.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">الموضوع *</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                >
                  <option value="">اختر الموضوع</option>
                  <option value="order">استفسار عن طلب</option>
                  <option value="product">سؤال عن منتج</option>
                  <option value="complaint">شكوى</option>
                  <option value="suggestion">اقتراح</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">الرسالة *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="6"
                  placeholder="اكتب رسالتك هنا..."
                ></textarea>
              </div>

              <button type="submit" className="btn-submit" disabled={submitting}>
                <span>{submitting ? 'جاري الإرسال...' : 'إرسال الرسالة'}</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
          </section>

          {/* Social Media & Map */}
          <aside className="contact-sidebar">
            {/* Social Media */}
            <div className="social-section">
              <h3 className="sidebar-title">🌟 تابعنا على</h3>
              <div className="social-links">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    className={`social-link social-tone-${index + 1}`}
                    target={social.url.startsWith('http') ? '_blank' : undefined}
                    rel={social.url.startsWith('http') ? 'noreferrer' : undefined}
                  >
                    <span className="social-icon">{social.icon}</span>
                    <span className="social-name">{social.name}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* FAQ Quick Links */}
            <div className="faq-section">
              <h3 className="sidebar-title">❓ أسئلة شائعة</h3>
              <div className="faq-links">
                <div className="faq-item">
                  <span className="faq-icon">📦</span>
                  <span>كيف أتتبع طلبي؟</span>
                </div>
                <div className="faq-item">
                  <span className="faq-icon">↩️</span>
                  <span>سياسة الإرجاع والاستبدال</span>
                </div>
                <div className="faq-item">
                  <span className="faq-icon">💳</span>
                  <span>طرق الدفع المتاحة</span>
                </div>
                <div className="faq-item">
                  <span className="faq-icon">🚚</span>
                  <span>معلومات الشحن</span>
                </div>
              </div>
            </div>

            {/* Support Hours */}
            <div className="support-hours">
              <div className="support-badge">
                <span className="badge-icon">💬</span>
                <div className="badge-content">
                  <strong>دعم فني متاح 24/7</strong>
                  <small>نحن هنا لخدمتك دائماً</small>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
