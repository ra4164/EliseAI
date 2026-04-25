import React, { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useCreateLeads, getListLeadsQueryKey, getGetLeadStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

const singleLeadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  company: z.string().min(2, "Company is required"),
  propertyAddress: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required").default("USA"),
});

export default function AddLeads() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createLeads = useCreateLeads();
  const [bulkInput, setBulkInput] = useState("");

  const form = useForm<z.infer<typeof singleLeadSchema>>({
    resolver: zodResolver(singleLeadSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      propertyAddress: "",
      city: "",
      state: "",
      country: "USA"
    }
  });

  const onSubmitSingle = (values: z.infer<typeof singleLeadSchema>) => {
    createLeads.mutate({ data: { leads: [values] } }, {
      onSuccess: () => {
        toast.success("Lead created successfully");
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
        setLocation("/leads");
      },
      onError: (err) => {
        toast.error("Failed to create lead", {
          description: err instanceof Error ? err.message : "Unknown error"
        });
      }
    });
  };

  const onSubmitBulk = () => {
    if (!bulkInput.trim()) {
      toast.error("Please enter some data");
      return;
    }

    try {
      const lines = bulkInput.trim().split('\n');
      const leadsToCreate = lines.map((line, idx) => {
        // Simple CSV parsing assuming no quotes
        const parts = line.split(/,|\t/).map(s => s.trim());
        if (parts.length < 6) {
          throw new Error(`Line ${idx + 1} does not have enough columns`);
        }
        return {
          name: parts[0],
          email: parts[1],
          company: parts[2],
          propertyAddress: parts[3],
          city: parts[4],
          state: parts[5],
          country: parts[6] || "USA"
        };
      });

      createLeads.mutate({ data: { leads: leadsToCreate } }, {
        onSuccess: (res) => {
          toast.success(`Successfully added ${leadsToCreate.length} leads`);
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
          setLocation("/leads");
        },
        onError: (err) => {
          toast.error("Failed to bulk create leads");
        }
      });
    } catch (e) {
      toast.error("Format error", {
        description: e instanceof Error ? e.message : "Invalid format"
      });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Leads</h1>
          <p className="text-muted-foreground mt-1">Input details to push leads into the enrichment pipeline.</p>
        </div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="single">Single Lead</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Paste (CSV)</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>Add a single lead to the pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitSingle)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="jane@property.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company / Property Group</FormLabel>
                          <FormControl>
                            <Input placeholder="Equity Residential" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="propertyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="San Francisco" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="USA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createLeads.isPending} size="lg">
                      {createLeads.isPending ? "Adding..." : "Add Lead"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Paste</CardTitle>
              <CardDescription>
                Paste CSV or TSV data. Format: 
                <code className="mx-2 px-2 py-1 bg-muted rounded text-xs">name, email, company, address, city, state, country</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder={`John Smith, john@example.com, Greystar, 456 Oak Ave, Austin, TX, USA\nSarah Connor, sarah@bldgs.com, Bozzuto, 789 Pine St, Denver, CO, USA`}
                className="min-h-[300px] font-mono text-sm"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
              <div className="flex justify-end pt-2">
                <Button onClick={onSubmitBulk} disabled={createLeads.isPending || !bulkInput.trim()} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Process Bulk Leads
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
