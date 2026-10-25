import {Roboto} from 'next/font/google';
import {AppRouterCacheProvider} from '@mui/material-nextjs/v16-appRouter';
import Theme from '../components/Theme';
import {BASE_PATH} from '../lib/config';
import './globals.css';
const roboto=Roboto({subsets:['latin'],display:'swap',variable:'--font-roboto'});
const siteURL=process.env.NEXT_PUBLIC_SITE_URL;
export const metadata={...(siteURL?{metadataBase:new URL(siteURL)}:{}),title:'StudyDock — Make sense of every missed question',description:'A calmer Udemy study workspace. Review questions, keep your own notes, and export Markdown or JSON. Browser-first, with an optional desktop app.',icons:{icon:`${BASE_PATH}/favicon.png`},openGraph:{title:'StudyDock — A better practice-test review',description:'Question notes, focused review, and study exports. Your next study session starts here.',...(siteURL?{images:[new URL('images/focus-review.png',siteURL).href]}:{})}};
export default function Layout({children}) {
  return <html lang="en" className={roboto.variable} suppressHydrationWarning><body><AppRouterCacheProvider><Theme>{children}</Theme></AppRouterCacheProvider></body></html>;
}
