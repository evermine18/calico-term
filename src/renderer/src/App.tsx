import TerminalComponent from "./components/terminal";

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send("ping");

  return (
    <>
      <div className="app">
        <div className="terminal-container">
          <TerminalComponent />
        </div>
      </div>
    </>
  );
}

export default App;
