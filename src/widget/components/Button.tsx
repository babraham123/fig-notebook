import { ButtonStyle, metrics } from "../tokens";

const { AutoLayout, Text } = figma.widget;

const STROKE_TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

interface Props {
  style: ButtonStyle;
  children: string;
  onClick?: (event: WidgetClickEvent) => Promise<void> | void;
}

export function Button({ style, children, onClick }: Props) {
  return (
    <AutoLayout
      padding={metrics.buttonPadding}
      fill={style.fill}
      cornerRadius={metrics.cornerRadius}
      stroke={style.stroke ?? STROKE_TRANSPARENT}
      strokeWidth={2}
      hoverStyle={{ stroke: style.strokeHover ?? STROKE_TRANSPARENT }}
      onClick={onClick}
    >
      <Text fill={style.textFill}>{children}</Text>
    </AutoLayout>
  );
}
