# TicTacToe benchmark

Same game, same moves (X0 O3 X1 O4 X2), production builds, headless Chromium, median of 5 loads and 25 clicks.

| app     | exec JS raw | exec JS gzip | load (DCL) ms | click latency ms | heap KB |
| ------- | ----------- | ------------ | ------------- | ---------------- | ------- |
| vanilla | 2255        | 889          | 43            | 0.1              | 2582    |
| laghu   | 21865       | 7119         | 44            | 0.2              | 2862    |
| react   | 220806      | 68244        | 63            | 0.2              | 3435    |
| vue     | 64154       | 25035        | 46            | 0.3              | 3043    |
| angular | 112782      | 38075        | 53            | 0.2              | 3402    |
