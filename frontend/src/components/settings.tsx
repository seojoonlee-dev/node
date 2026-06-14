import { useNavigate } from 'react-router-dom';
import { TintedImage } from './tintedImage';
import { Link, useParams } from 'react-router-dom';
import { useState, type ChangeEvent } from 'react';
import { getStartupNote, setStartupNote } from '../helpers/startupNote';
import '../style/settings.css';

// The demo stores notes in the browser (IndexedDB) and has no backend, so the
// server address setting is irrelevant there.
const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';

function General() {
  const serverIp = localStorage.getItem('serverIp') ? localStorage.getItem('serverIp') : "http://localhost:3001";
  const [value, setTitle] = useState(serverIp);
  const [startup, setStartup] = useState(getStartupNote());

  const saveServer = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setTitle(inputValue);
  };

  const changeServer = () => {
    if (value) {
      const trimmedValue = value.trim();
      localStorage.setItem('serverIp', trimmedValue);
    }
  };

  const changeStartup = () => setStartupNote(startup);

  return (
    <>
      <div className='settings-view'>
        <h3>Startup note</h3>
        <p>Note to open automatically when the app loads. Leave empty to start on the home screen.</p>
        <input
          type='text'
          name='startup'
          value={startup}
          placeholder='e.g. Note or Projects/Ideas'
          onChange={(e) => setStartup(e.target.value)}
          onBlur={changeStartup}
        />
      </div>
      <div className='settings-view'>
        <h3>Server</h3>
          {
            !isDemo ? (
              <>
                <p>Enter server IP address and port (example: http://192.168.0.1:3001): </p>
                <input type='text' name='server' defaultValue={serverIp!} onChange={saveServer} onBlur={changeServer}></input>
              </>
            ) : (
              <p>This is a demo. Your notes are saved locally in this browser.</p>
            )
          }
      </div>
    </>
  )
}

function Theme() {
  return (
    <>
      <div className='settings-view'>
        <p>wip</p>
      </div>
    </>
  )
}

function Demo() {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!window.confirm('Reset the demo? This deletes all notes in this browser and restores the default note.')) {
      return;
    }
    setResetting(true);
    // Loaded lazily so demo-only code stays out of the self-hosted bundle.
    const { resetDemo } = await import('../helpers/demoStore');
    await resetDemo();
    window.location.href = '/';
  };

  return (
    <div className='settings-view'>
      <h3>Reset demo</h3>
      <p>Delete all notes saved in this browser and restore the default note.</p>
      <button className='btn-reset' onClick={handleReset} disabled={resetting}>
        {resetting ? 'Resetting…' : 'Reset demo'}
      </button>
    </div>
  );
}


interface SettingsProps {
  to:string;
}


export function Settings({to}: SettingsProps) {
  const { '*': setting } = useParams();
  const navigate = useNavigate();

  function capitalizeFirstLetter(text?: string): string {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  return (
    <>
      <div className="l-app l-settings">
        <div className="l-header">
          <button className="btn-header" onClick={() => {navigate(to); console.log(to);}}>
            <TintedImage src='/back.png' alt="Toggle Sidebar" />
          </button>
          <h2 className='header-title'>Settings</h2>
        </div>
        <div>
      <div className='settings-tabbar'>
          <Link to={`/settings/general`} className={`settings-link ${setting === "general" ? 'is-active': ''}`}>
            <button className="btn-tabbar">General</button>
          </Link>
          <Link to={`/settings/theme`} className={`settings-link ${setting === "theme" ? 'is-active': ''}`}>
            <button className="btn-tabbar">Theme</button>
          </Link>
          {isDemo && (
            <Link to={`/settings/demo`} className={`settings-link ${setting === "demo" ? 'is-active': ''}`}>
              <button className="btn-tabbar">Demo</button>
            </Link>
          )}
        </div>
      </div>
        <div className='settings-main'>
          <h1 className='settings-title'>{capitalizeFirstLetter(setting)}</h1>
          {setting === "general" ? <General /> : setting === "demo" && isDemo ? <Demo /> : <Theme />}
        </div>
      </div>
    </>
  );
}