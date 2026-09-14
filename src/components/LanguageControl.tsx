import { setLocale, t, useLocale } from '../i18n/locale';

export function LanguageControl() {
  const locale = useLocale();
  return <select className="language-control" aria-label={t('Language')} value={locale}
    onChange={event => setLocale(event.target.value === 'zh-CN' ? 'zh-CN' : 'en')}>
    <option lang="en" value="en">English</option>
    <option lang="zh-CN" value="zh-CN">简体中文</option>
  </select>;
}
