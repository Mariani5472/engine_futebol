export interface Random {
  next(): number;
  nextFloat(
    min: number,
    max: number
  ): number;
  nextInt(
    min: number,
    max: number
  ): number;
}