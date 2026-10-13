import { Routes, Route } from 'react-router';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import AskPill from './components/AskPill.jsx';
import Home from './pages/Home.jsx';
import Platform from './pages/Platform.jsx';
import Capability from './pages/Capability.jsx';
import UseCase from './pages/UseCase.jsx';
import CreditUnions from './pages/CreditUnions.jsx';
import Company from './pages/Company.jsx';
import Demo from './pages/Demo.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <ScrollManager />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/platform" element={<Platform />} />
        <Route path="/platform/:slug" element={<Capability />} />
        <Route path="/use-cases/:slug" element={<UseCase />} />
        <Route path="/credit-unions" element={<CreditUnions />} />
        <Route path="/company" element={<Company />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <AskPill />
    </>
  );
}
