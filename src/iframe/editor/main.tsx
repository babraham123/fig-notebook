import ReactDOM from 'react-dom';
import './index.css';
import AppContainer from './EditorApp';

export function setupEditor() {
  ReactDOM.render(<AppContainer />, document.getElementById("root"));
}