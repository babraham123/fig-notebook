import { badges, metrics } from "../tokens";

const { AutoLayout, Text } = figma.widget;

interface Props {
  name: string;
}

export function Badge({ name }: Props) {
  return (
    <AutoLayout
      padding={metrics.buttonPadding}
      fill={badges[name].fill}
      cornerRadius={metrics.cornerRadius}
    >
      <Text fill={badges[name].textFill}>{name}</Text>
    </AutoLayout>
  );
}
