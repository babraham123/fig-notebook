import { BadgeStyle, metrics } from "../tokens";

const { AutoLayout, Text } = figma.widget;

interface Props {
  style: BadgeStyle;
  children: string;
}

export function Badge({ style, children }: Props) {
  return (
    <AutoLayout
      padding={metrics.buttonPadding}
      fill={style.fill}
      cornerRadius={metrics.cornerRadius}
    >
      <Text fill={style.textFill}>{children}</Text>
    </AutoLayout>
  );
}
