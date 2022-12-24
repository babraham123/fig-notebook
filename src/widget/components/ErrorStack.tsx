import { colors, metrics, fontFamily } from "../tokens";

import { ErrorLike } from "../../shared/types";

const { Text } = figma.widget;

interface Props {
  error: ErrorLike;
}

export function ErrorStack({ error }: Props) {
  return (
    <Text
      fill={colors.textDark}
      fontFamily={fontFamily}
      width={metrics.width - metrics.padding * 2}
    >
      {error.formattedMessageAndStack || error.stack}
    </Text>
  );
}
