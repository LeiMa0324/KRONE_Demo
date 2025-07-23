export type DemoInfoTreeNode = {
  name: string;
  entity: string;
  action?: string;
  event_id?: string;
  log_template?: string;
  status?: string;
  children: DemoInfoTreeNode[];
};

export const demoTreeData = {
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

export const demoInfoTree: DemoInfoTreeNode = {
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

export const demoDecompData = [
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

export const demoDetectData = [
  {
    seq_id: "SEQ001",
    seq: ["4"],
    anomaly_seg: ["4"], 
    anomaly_level: "action" as "entity" | "action" | "status",
    anomaly_reason: "Unexpected action order: 'Succeeds' occurred before 'Start' for Auth.",
  },
];