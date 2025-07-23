export const FeaturesDescriptionText = {
  intro: (
    <p className="text-left text-neutral-700 text-lg max-w-7xl mb-15">
      KRONE helps you monitor and understand your system logs by turning raw messages into structured, interactive knowledge graphs. Instead of treating logs as simple lists, KRONE breaks each message into its core components, status, action, and entity, so you can easily visualize how events unfold, spot unusual patterns, and pinpoint the root causes of problems. With KRONE, you can explore log sequences, detect anomalies at any level, and quickly compare normal and abnormal behaviors, making it easier to keep your systems secure and reliable.
    </p>
  ),
  visualize: (
    <p className="text-left mb-6 text-neutral-700 text-lg">
      KRONE transforms raw log messages by extracting <b>entities</b> (such as "Session" or "Auth"), <b>actions</b> (like "Open" or "Start"), and <b>statuses</b> ("Started", "Success", etc.). Each log message is reanalyzed as a structured template: <i>[Entity] [Action] [Status]</i>. This process uncovers hierarchical relationships and recurring patterns in your logs.<br /><br />
      <b>Example:</b> The log message <i>"Session opened successfully"</i> is parsed as:<br />
      <b>Entity:</b> Session<br />
      <b>Action:</b> Open<br />
      <b>Status:</b> Success<br /><br />
    </p>
  ),
  visualizeFooter: (
    <p className="text-left text-neutral-700 text-lg">
      This feature allows you to interactively explore the structure of your logs. You can <b>hover</b> over any node to examine all extracted log templates associated with that point in the tree, or <b>search</b> the tree to quickly locate and inspect a specific log template. This makes it easy to understand event flows and identify patterns within your system.
    </p>
  ),
  sequence: (
    <p className="text-left mb-6 text-neutral-700 text-lg">
      Once every log message is analyzed as a structured template of <b>entity</b>, <b>action</b>, and <b>status</b>, KRONE can further analyze <b>sequences of log messages</b> as transitions between these extracted components. This enables precise <b>anomaly detection</b> within event flows.<br /><br />
      <b>Example:</b> In the sequence shown, the expected action for the <b>Auth</b> entity was <i>Start</i>, but instead <i>Succeeds</i> occurred first. This <b>out-of-order action</b> is flagged as an <b>anomaly</b>, helping you quickly identify unexpected or erroneous behavior in your system.
    </p>
  ),
  sequenceFooter: (
    <p className="text-left text-neutral-700 text-lg mt-6">
      You can <b>select a sequence</b> and <b>click on individual nodes</b> to view detailed information. Selecting a <b>status node</b> reveals the full log sequence for that template, and you can <b>search this sequence in the knowledge base</b> to find similar patterns and explanations that KRONE has learned. This interactive exploration helps you understand not only <b>where anomalies occur</b>, but also <b>how they relate to other known behaviors</b> in your system.
    </p>
  ),
  knowledge: (
    <p className="text-left mb-6 text-neutral-700 text-lg">
      The <b>Knowledge Base</b> contains all <b>sequence data</b> contained in the training and testing data for KRONE. You can <b>browse every sequence</b>, review whether KRONE has predicted it as <b>normal</b> or <b>abnormal</b>, and read a clear, verbal <b>summary</b> explaining what is happening in each sequence. For every sequence, you can also see the <b>prediction explanation</b> behind KRONE’s labeling, helping you understand not just the <b>patterns</b> in your data, but also the <b>reasoning</b> behind each classification.
    </p>
  ),
  knowledgeFooter: (
    <p className="text-left text-neutral-700 text-lg mt-6">
      You can <b>search for a specific sequence</b> using the log key sequence, <b>view the sequence summary and explanation</b>, and <b>search for similar sequences</b>.
    </p>
  ),
};