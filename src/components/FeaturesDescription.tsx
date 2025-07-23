import { VizTree } from "./viz_tree_components/viz_tree/viz_tree";
import { TreeInfoPanel } from "./viz_tree_components/info_panel/tree_info_panel";
import { SequenceTree } from "./sequence_tree";
import { SequenceUnitDisplay } from "./KnowledgeBaseSideBar";
import { hierarchy } from "d3-hierarchy";
import type { TreeNode } from "../tree_utils";

type DemoInfoTreeNode = {
  name: string;
  entity: string;
  action?: string;
  event_id?: string;
  log_template?: string;
  status?: string;
  children: DemoInfoTreeNode[];
};

const demoTreeData = {
  name: "Root",
  children: [
    {
      name: "Session",
      children: [
        {
          name: "Open",
          children: [
            {
              name: "Started",
              event_id: "1",
              log_template: "Session started",
              entity: "Session",
              action: "Open",
              status: "Started",
            },
            {
              name: "Success",
              event_id: "2",
              log_template: "Session opened successfully",
              entity: "Session",
              action: "Open",
              status: "Success",
            },
          ],
        },
      ],
    },
    {
      name: "Auth",
      children: [
        {
          name: "Start",
          children: [
            {
              name: "None_1",
              event_id: "3",
              log_template: "Auth start initiated",
              entity: "Auth",
              action: "Start",
              status: "None_1",
            },
          ],
        },
        {
          name: "Succeeds",
          children: [
            {
              name: "None_2",
              event_id: "4",
              log_template: "Auth succeeded",
              entity: "Auth",
              action: "Succeeds",
              status: "None_2",
            },
          ],
        },
      ],
    },
  ],
};

const demoInfoTree: DemoInfoTreeNode = {
  name: "Root",
  entity: "Root",
  children: [
    {
      name: "Session",
      entity: "Session",
      children: [
        {
          name: "Open",
          entity: "Session",
          action: "Open",
          children: [
            {
              name: "Success",
              event_id: "2",
              log_template: "Session opened successfully",
              entity: "Session",
              action: "Open",
              status: "Success",
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

const demoInfoNode = hierarchy<TreeNode>(demoInfoTree).children?.[0]?.children?.[0]?.children?.[0] ?? null;

const demoDecompData = [
  {
    seq_id: "SEQ001",
    seq: ["1", "2", "4", "3"],
    entity_nodes_for_logkeys: [
      "Session",
      "Session",
      "Auth",
      "Auth",
    ],
    action_nodes_for_logkeys: [
      "Open",
      "Open",
      "Succeeds", 
      "Start",
    ],
    status_nodes_for_logkeys: [
      "Started",
      "Success",
      "None_2",
      "None_1",
    ],
  },
];

const demoDetectData = [
  {
    seq_id: "SEQ001",
    seq: ["4"],
    anomaly_seg: ["4"], 
    anomaly_level: "action" as "entity" | "action" | "status",
    anomaly_reason: "Unexpected action order: 'Succeeds' occurred before 'Start' for Auth.",
  },
];

export const FeaturesDescription = () => (
  <div className="w-full bg-white py-16 px-4 flex flex-col items-center justify-center z-10 relative">
    <h1 className="text-4xl font-bold mb-8">Welcome to KRONE</h1>
    <div className="w-full flex justify-center mb-8">
      <p className="text-left text-neutral-700 text-lg max-w-7xl mb-15">
        KRONE helps you monitor and understand your system logs by turning raw messages into structured, interactive knowledge graphs. Instead of treating logs as simple lists, KRONE breaks each message into its core components, status, action, and entity, so you can easily visualize how events unfold, spot unusual patterns, and pinpoint the root causes of problems. With KRONE, you can explore log sequences, detect anomalies at any level, and quickly compare normal and abnormal behaviors, making it easier to keep your systems secure and reliable.
      </p>
    </div>
    <div className="w-full max-w-5xl flex flex-col gap-12">
      {/* Row 1: Visualize Tree */}
      <div className="flex flex-col items-center bg-neutral-50 rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-4">Visualize Semantic Hierarchy of Your Log Data</h2>
        <p className="text-left mb-6 text-neutral-700 text-lg">
          KRONE transforms raw log messages by extracting <b>entities</b> (such as "Session" or "Auth"), <b>actions</b> (like "Open" or "Start"), and <b>statuses</b> ("Started", "Success", etc.). Each log message is reanalyzed as a structured template: <i>[Entity] [Action] [Status]</i>. This process uncovers hierarchical relationships and recurring patterns in your logs.<br /><br />
          <b>Example:</b> The log message <i>"Session opened successfully"</i> is parsed as:<br />
          <b>Entity:</b> Session<br />
          <b>Action:</b> Open<br />
          <b>Status:</b> Success<br /><br />
        </p>
        <div
          style={{
            width: "100%",
            minHeight: 400,
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <VizTree
              treeData={demoTreeData}
              collapseEntities={false}
              collapseActions={false}
              collapseStatuses={false}
              matchedNodeId={"2"}
              showAnomalySymbols={false}
              collapsible={false}
              disableHoverHighlight={true}
              clickableNodes={false}
            />
          </div>
          <div style={{ maxWidth: 350, marginLeft: 32 }}>
            <TreeInfoPanel node={demoInfoNode ?? null} />
          </div>
        </div>
        <p className="text-left text-neutral-700 text-lg">
          This feature allows you to interactively explore the structure of your logs. You can <b>hover</b> over any node to examine all extracted log templates associated with that point in the tree, or <b>search</b> the tree to quickly locate and inspect a specific log template. This makes it easy to understand event flows and identify patterns within your system.
        </p>
      </div>
      {/* Row 2: Sequence Tree */}
      <div className="flex flex-col items-center bg-neutral-50 rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-4">Log Sequence Anomaly Detection and Explanation</h2>
        <p className="text-left mb-6 text-neutral-700 text-lg">
            Once every log message is analyzed as a structured template of <b>entity</b>, <b>action</b>, and <b>status</b>, KRONE can further analyze <b>sequences of log messages</b> as transitions between these extracted components. This enables precise <b>anomaly detection</b> within event flows.<br /><br />
            <b>Example:</b> In the sequence shown, the expected action for the <b>Auth</b> entity was <i>Start</i>, but instead <i>Succeeds</i> occurred first. This <b>out-of-order action</b> is flagged as an <b>anomaly</b>, helping you quickly identify unexpected or erroneous behavior in your system.
        </p>
        <div style={{ width: "100%", minHeight: 400 }}>
          <SequenceTree
            kroneDecompData={demoDecompData}
            kroneDetectData={demoDetectData}
            setHoveredNode={() => {}}
            setMultiLineAnomaly={() => {}}
            multiLineAnomaly={false}
            demoMode={true}
          />
        </div>
        <p className="text-left text-neutral-700 text-lg mt-6">
          You can <b>select a sequence</b> and <b>click on individual nodes</b> to view detailed information. Selecting a <b>status node</b> reveals the full log sequence for that template, and you can <b>search this sequence in the knowledge base</b> to find similar patterns and explanations that KRONE has learned. This interactive exploration helps you understand not only <b>where anomalies occur</b>, but also <b>how they relate to other known behaviors</b> in your system.
        </p>
      </div>
      {/* Row 3: Knowledge Base */}
      <div className="flex flex-col items-center bg-neutral-50 rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-4">Knowledge Base</h2>
        <p className="text-left mb-6 text-neutral-700 text-lg">
          The <b>Knowledge Base</b> contains all <b>sequence data</b> contained in the training and testing data for KRONE. You can <b>browse every sequence</b>, review whether KRONE has predicted it as <b>normal</b> or <b>abnormal</b>, and read a clear, verbal <b>summary</b> explaining what is happening in each sequence. For every sequence, you can also see the <b>prediction explanation</b> behind KRONE’s labeling, helping you understand not just the <b>patterns</b> in your data, but also the <b>reasoning</b> behind each classification.
        </p>
        <div className="flex flex-col items-center justify-center h-full w-full" style={{ minHeight: 200 }}>
          {/* Use SequenceUnitDisplay for demo card */}
          <SequenceUnitDisplay
            orderNum={1}
            seq={{
              arr: ["Start", "Succeeds"],
              explanation: "GT",
              seqType: "ACTION",
              isAnomaly: false,
              logkey_seq: [],
              embedding: [],
              path_summary: "The actions for Auth occurred in the expected order: 'Start' followed by 'Succeeds'.",
            }}
            allSequences={[]} // or a demo array if you want
            handleApproximateSearch={() => {}} // no-op for demo
            collapsible={false}
          />
          <p className="text-left text-neutral-700 text-lg mt-6">
            You can <b>search for a specific sequence</b> using the log key sequence, <b>view the sequence summary and explanation</b>, and <b>search for similar sequences</b>.
          </p>
        </div>
      </div>
    </div>
  </div>
);