import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import {PrivacyPolicy} from '../../components/Privacy';
import {asset} from '../../lib/config';

export const metadata={title:'Privacy policy | StudyDock',description:'How StudyDock handles question content, notes, exports and website data.'};

export default function PrivacyPage() {
  return <><a className="skip-link" href="#policy">Skip to privacy policy</a><div className="page-wrap">
    <header className="site-header"><a className="wordmark" href={asset('')} aria-label="StudyDock home"><img src={asset('images/studydock.png')} width="36" height="36" alt=""/>StudyDock</a><a className="text-link" href={asset('')}><ArrowBackRounded fontSize="small"/>Back to StudyDock</a></header>
    <main id="policy" className="privacy-document"><span className="eyebrow">Your data</span><h1>Privacy policy</h1><PrivacyPolicy/></main>
  </div></>;
}
