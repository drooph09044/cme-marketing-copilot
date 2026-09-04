import { NODE_KIND } from "../../lib/nodeKinds";
import type { JourneyNode } from "../../lib/types";

interface Props {
  node: JourneyNode | null;
}

export default function InspectTab({ node }: Props) {
  if (!node) {
    return (
      <div className="jo-pane jo-empty">
        <div className="jo-empty__inner">
          <div className="jo-empty__title">Nothing selected</div>
          <p>Click any node on the canvas to inspect its configuration.</p>
        </div>
      </div>
    );
  }
  const k = NODE_KIND[node.type];
  return (
    <div className="jo-pane">
      <div className="jo-pane__head">
        <div>
          <div className="jo-eyebrow">{k?.label ?? node.type}</div>
          <h3 style={{ marginTop: 2 }}>{node.title}</h3>
          <p>{node.sub}</p>
        </div>
      </div>
      <dl className="jo-dl">
        <div><dt>Node ID</dt><dd className="mono">{node.id}</dd></div>
        <div><dt>Type</dt><dd>{node.type}</dd></div>
        <div><dt>Position</dt><dd className="mono">{node.x}, {node.y}</dd></div>
        {node.meta ? <div><dt>Detail</dt><dd>{node.meta}</dd></div> : null}
      </dl>
    </div>
  );
}
