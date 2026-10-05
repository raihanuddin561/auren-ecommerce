/** Who is asking: the signed-in customer, and/or the raw value of the bag cookie. */
export interface CartIdentity {
  userId: string | null;
  token: string | null;
}
