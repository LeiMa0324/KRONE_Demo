import { VizTree } from "../viz_tree_components/viz_tree/viz_tree";
import { TreeInfoPanel } from "../viz_tree_components/info_panel/tree_info_panel";
import { SequenceTree } from "../sequence_tree";
import { SequenceUnitDisplay } from "../KnowledgeBaseSideBar";
import { hierarchy } from "d3-hierarchy";
import type { TreeNode } from "../../tree_utils";
import { FeaturesDescriptionText } from "./FeaturesDescriptionText";
import {
  demoTreeData,
  demoInfoTree,
  demoDecompData,
  demoDetectData,
} from "./demoData";

const demoInfoNode = hierarchy<TreeNode>(demoInfoTree).children?.[0]?.children?.[0]?.children?.[0] ?? null;

export const FeaturesDescription = () => (
  <div className="w-full bg-white py-16 px-4 flex flex-col items-center justify-center z-10 relative">
    <h1 className="text-4xl font-bold mb-8">Welcome to KRONE</h1>
    <div className="w-full flex justify-center mb-8">
      {FeaturesDescriptionText.intro}
    </div>
    <div className="w-full max-w-5xl flex flex-col gap-12">
      {/* Row 1: Visualize Tree */}
      <div className="flex flex-col items-center bg-neutral-50 rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-4">Visualize Semantic Hierarchy of Your Log Data</h2>
        {FeaturesDescriptionText.visualize}
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
        {FeaturesDescriptionText.visualizeFooter}
      </div>
      {/* Row 2: Sequence Tree */}
      <div className="flex flex-col items-center bg-neutral-50 rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-4">Log Sequence Anomaly Detection and Explanation</h2>
        {FeaturesDescriptionText.sequence}
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
        {FeaturesDescriptionText.sequenceFooter}
      </div>
      {/* Row 3: Knowledge Base */}
      <div className="flex flex-col items-center bg-neutral-50 rounded-lg shadow p-8">
        <h2 className="text-3xl font-bold mb-4">Knowledge Base</h2>
        {FeaturesDescriptionText.knowledge}
        <div className="flex flex-col items-center justify-center h-full w-full" style={{ minHeight: 200 }}>
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
            allSequences={[]}
            handleApproximateSearch={() => {}}
            collapsible={false}
          />
          {FeaturesDescriptionText.knowledgeFooter}
        </div>
      </div>
    </div>
  </div>
);