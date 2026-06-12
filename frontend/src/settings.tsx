import { useNavigate } from 'react-router-dom';
import { TintedImage } from './helpers/TintedImage';
import { Link, useParams } from 'react-router-dom';
import { useState, type ChangeEvent } from 'react';
import './style/Settings.css';

function General() {
  const serverIp = localStorage.getItem('serverIp') ? localStorage.getItem('serverIp') : "http://localhost:3001";
  const [value, setTitle] = useState(serverIp);

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
  
  return (
    <>
      <div className='settings-view'> 
        <h3>Server</h3>
        <p>Enter server IP address and port (example: http://192.168.0.1:3001): </p>
        <input type='text' name='server' defaultValue={serverIp!} onChange={saveServer} onBlur={changeServer}></input>
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
        </div>
      </div>
        <div className='settings-main'>
          <h1 className='settings-title'>{capitalizeFirstLetter(setting)}</h1>
          {setting === "general" ? <General /> : <Theme />}
        </div>
      </div>
    </>
  );
}