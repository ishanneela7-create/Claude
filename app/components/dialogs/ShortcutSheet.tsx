import { Modal } from '../ui/Modal';

const SHORTCUTS: Array<[string, string]> = [
  ['/', 'Jump to the search box'],
  ['n', 'New part'],
  ['e', 'Edit the open part'],
  ['Esc', 'Close the panel or dialog'],
  ['?', 'Show this sheet'],
  ['Ctrl + Z', 'Undo (Cmd + Z on Mac)'],
  ['Ctrl + Shift + Z', 'Redo'],
];

const SEARCH_TIPS: Array<[string, string]> = [
  ['color:red', 'Parts whose color name has "red"'],
  ['cat:plates', 'Category'],
  ['loc:"Drawer 3"', 'Location (use quotes for spaces)'],
  ['qty:>5', 'Quantity: > < >= <= or exact'],
  ['custom:true', 'Only custom parts (false = official)'],
  ['tag:favorite', 'Tag'],
];

export function ShortcutSheet({ onClose }: { onClose(): void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {SHORTCUTS.map(([key, text]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="rounded border border-line bg-raised px-2 py-0.5 font-mono text-xs">{key}</kbd>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-2 mt-5 font-semibold">Search tips</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {SEARCH_TIPS.map(([key, text]) => (
          <div key={key} className="contents">
            <dt>
              <code className="rounded bg-raised px-2 py-0.5 font-mono text-xs">{key}</code>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
